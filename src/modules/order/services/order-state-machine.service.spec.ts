import { Test, TestingModule } from '@nestjs/testing';
import { OrderStateMachineService } from './order-state-machine.service';
import { OrderStatus } from '../../../common/constants';
import { CustomHttpException } from '../../../common/exceptions';

describe('OrderStateMachineService', () => {
  let service: OrderStateMachineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OrderStateMachineService],
    }).compile();

    service = module.get<OrderStateMachineService>(OrderStateMachineService);
  });

  describe('canTransition', () => {
    it('should allow transition from PENDING to RESTAURANT_ACCEPTED', () => {
      expect(service.canTransition(OrderStatus.PENDING, OrderStatus.RESTAURANT_ACCEPTED)).toBe(
        true,
      );
    });

    it('should allow transition from PENDING to CANCELLED', () => {
      expect(service.canTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
    });

    it('should not allow transition from DELIVERED to CANCELLED', () => {
      expect(service.canTransition(OrderStatus.DELIVERED, OrderStatus.CANCELLED)).toBe(false);
    });

    it('should not allow transition from PENDING to DELIVERED', () => {
      expect(service.canTransition(OrderStatus.PENDING, OrderStatus.DELIVERED)).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should pass validation for valid transition', () => {
      expect(() => {
        service.validateTransition(OrderStatus.PENDING, OrderStatus.RESTAURANT_ACCEPTED);
      }).not.toThrow();
    });

    it('should throw error for invalid transition', () => {
      expect(() => {
        service.validateTransition(OrderStatus.PENDING, OrderStatus.DELIVERED);
      }).toThrow(CustomHttpException);
    });

    it('should throw error for same status transition', () => {
      expect(() => {
        service.validateTransition(OrderStatus.PENDING, OrderStatus.PENDING);
      }).toThrow(CustomHttpException);
    });
  });

  describe('getAllowedNextStatuses', () => {
    it('should return allowed statuses for PENDING', () => {
      const allowed = service.getAllowedNextStatuses(OrderStatus.PENDING);
      expect(allowed).toContain(OrderStatus.RESTAURANT_ACCEPTED);
      expect(allowed).toContain(OrderStatus.CANCELLED);
      expect(allowed).toContain(OrderStatus.FAILED);
    });

    it('should return empty array for terminal status DELIVERED', () => {
      const allowed = service.getAllowedNextStatuses(OrderStatus.DELIVERED);
      expect(allowed).toEqual([]);
    });
  });

  describe('isTerminalStatus', () => {
    it('should return true for DELIVERED status', () => {
      expect(service.isTerminalStatus(OrderStatus.DELIVERED)).toBe(true);
    });

    it('should return true for CANCELLED status', () => {
      expect(service.isTerminalStatus(OrderStatus.CANCELLED)).toBe(true);
    });

    it('should return false for PENDING status', () => {
      expect(service.isTerminalStatus(OrderStatus.PENDING)).toBe(false);
    });
  });

  describe('canBeCancelled', () => {
    it('should return true for PENDING status', () => {
      expect(service.canBeCancelled(OrderStatus.PENDING)).toBe(true);
    });

    it('should return true for PREPARING status', () => {
      expect(service.canBeCancelled(OrderStatus.PREPARING)).toBe(true);
    });

    it('should return false for DELIVERED status', () => {
      expect(service.canBeCancelled(OrderStatus.DELIVERED)).toBe(false);
    });

    it('should return false for PICKED_UP status', () => {
      expect(service.canBeCancelled(OrderStatus.PICKED_UP)).toBe(false);
    });
  });

  describe('getInitialStatus', () => {
    it('should return PENDING as initial status', () => {
      expect(service.getInitialStatus()).toBe(OrderStatus.PENDING);
    });
  });
});
