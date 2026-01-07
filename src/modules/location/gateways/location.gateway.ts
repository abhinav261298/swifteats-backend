import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';

interface LocationUpdateEvent {
  driverId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: Date;
}

interface DeliveryStatusEvent {
  deliveryId: string;
  orderId: string;
  previousStatus: string;
  newStatus: string;
  driverId: string;
}

@WebSocketGateway({
  cors: {
    origin: '*', // Configure this based on your frontend URL in production
    credentials: true,
  },
  namespace: '/tracking',
})
export class LocationGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LocationGateway.name);

  afterInit(_server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Client subscribes to track an order
   */
  @SubscribeMessage('trackOrder')
  handleTrackOrder(client: Socket, payload: { orderId: string }) {
    const { orderId } = payload;

    if (!orderId) {
      client.emit('error', { message: 'Order ID is required' });
      return;
    }

    // Join order-specific room
    client.join(`order:${orderId}`);

    this.logger.log(`Client ${client.id} joined room: order:${orderId}`);

    client.emit('trackingStarted', {
      orderId,
      message: 'Successfully subscribed to order tracking',
    });
  }

  /**
   * Client unsubscribes from order tracking
   */
  @SubscribeMessage('untrackOrder')
  handleUntrackOrder(client: Socket, payload: { orderId: string }) {
    const { orderId } = payload;

    if (!orderId) {
      return;
    }

    client.leave(`order:${orderId}`);

    this.logger.log(`Client ${client.id} left room: order:${orderId}`);

    client.emit('trackingStopped', { orderId });
  }

  /**
   * Listen to location.updated event from LocationBufferService
   * Broadcast to relevant order rooms
   */
  @OnEvent('location.updated')
  async handleLocationUpdate(event: LocationUpdateEvent) {
    this.logger.debug(`Broadcasting location update for driver: ${event.driverId}`);

    // Broadcast to driver-specific room (for all orders assigned to this driver)
    this.server.to(`driver:${event.driverId}`).emit('locationUpdate', {
      driverId: event.driverId,
      latitude: event.latitude,
      longitude: event.longitude,
      accuracy: event.accuracy,
      heading: event.heading,
      speed: event.speed,
      timestamp: event.timestamp,
    });
  }

  /**
   * Listen to delivery.created event
   * Set up room mapping for order tracking
   */
  @OnEvent('delivery.created')
  async handleDeliveryCreated(event: { deliveryId: string; orderId: string; driverId: string }) {
    this.logger.log(
      `Delivery created: ${event.deliveryId}, mapping order:${event.orderId} to driver:${event.driverId}`,
    );

    // Notify order room about driver assignment
    this.server.to(`order:${event.orderId}`).emit('driverAssigned', {
      orderId: event.orderId,
      deliveryId: event.deliveryId,
      driverId: event.driverId,
    });

    // Add order room to driver's broadcast list
    // This allows location updates to reach the order room
    const orderRoom = `order:${event.orderId}`;
    const driverRoom = `driver:${event.driverId}`;

    // Create a mapping so location updates for this driver reach this order
    this.server.in(orderRoom).socketsJoin(driverRoom);
  }

  /**
   * Listen to delivery.status.changed event
   * Broadcast status updates to order room
   */
  @OnEvent('delivery.status.changed')
  async handleDeliveryStatusChanged(event: DeliveryStatusEvent) {
    this.logger.log(
      `Broadcasting status change for order: ${event.orderId} (${event.previousStatus} → ${event.newStatus})`,
    );

    this.server.to(`order:${event.orderId}`).emit('statusUpdate', {
      orderId: event.orderId,
      deliveryId: event.deliveryId,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast custom message to order room
   */
  broadcastToOrder(orderId: string, event: string, data: any) {
    this.server.to(`order:${orderId}`).emit(event, data);
  }

  /**
   * Broadcast custom message to driver room
   */
  broadcastToDriver(driverId: string, event: string, data: any) {
    this.server.to(`driver:${driverId}`).emit(event, data);
  }

  /**
   * Get connected clients count
   */
  getConnectionsCount(): number {
    return this.server.sockets.sockets.size;
  }

  /**
   * Get rooms info (for debugging)
   */
  async getRoomsInfo(): Promise<any> {
    const rooms = await this.server.sockets.adapter.rooms;
    return {
      totalRooms: rooms.size,
      rooms: Array.from(rooms.keys()),
    };
  }
}
