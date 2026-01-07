import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { Order } from '../order/entities/order.entity';
import { PaymentStatus, PaymentMethod } from '../../common/constants';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepository: jest.Mocked<Repository<Payment>>;
  let orderRepository: jest.Mocked<Repository<Order>>;

  const mockPayment = {
    id: 'payment-uuid',
    orderId: 'order-uuid',
    paymentMethod: PaymentMethod.CARD,
    status: PaymentStatus.PENDING,
    amount: 500,
    retryCount: 0,
    transactionId: null,
    failureReason: null,
  } as Payment;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    paymentRepository = module.get(getRepositoryToken(Payment));
    orderRepository = module.get(getRepositoryToken(Order));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processPayment', () => {
    it('should process payment successfully on first attempt', async () => {
      const processPaymentDto = {
        orderId: 'order-uuid',
        paymentMethod: PaymentMethod.CARD,
        amount: 500,
      };

      paymentRepository.findOne.mockResolvedValue(null);
      paymentRepository.create.mockReturnValue(mockPayment);
      paymentRepository.save
        .mockResolvedValueOnce(mockPayment) // Initial save
        .mockResolvedValueOnce({ ...mockPayment, status: PaymentStatus.PROCESSING }) // Processing
        .mockResolvedValueOnce({
          ...mockPayment,
          status: PaymentStatus.SUCCESS,
          transactionId: 'TXN-123456',
        }); // Success

      // Mock successful payment
      jest.spyOn<any, any>(service, 'mockPaymentGateway').mockResolvedValue({
        success: true,
        transactionId: 'TXN-123456',
      });

      const result = await service.processPayment(processPaymentDto);

      expect(result.status).toBe(PaymentStatus.SUCCESS);
      expect(result.transactionId).toBe('TXN-123456');
      expect(paymentRepository.save).toHaveBeenCalledTimes(3);
    });

    it('should return existing successful payment', async () => {
      const existingPayment = {
        ...mockPayment,
        status: PaymentStatus.SUCCESS,
        transactionId: 'TXN-EXISTING',
      };

      paymentRepository.findOne.mockResolvedValue(existingPayment as Payment);

      const result = await service.processPayment({
        orderId: 'order-uuid',
        paymentMethod: PaymentMethod.CARD,
        amount: 500,
      });

      expect(result).toEqual(existingPayment);
      expect(paymentRepository.create).not.toHaveBeenCalled();
    });

    it('should retry failed payment up to 3 times', async () => {
      paymentRepository.findOne.mockResolvedValue(null);
      paymentRepository.create.mockReturnValue(mockPayment);

      // Mock all saves
      paymentRepository.save.mockResolvedValue(mockPayment as Payment);

      // Mock sleep to avoid delays in test
      jest.spyOn<any, any>(service, 'sleep').mockResolvedValue(undefined);

      // Mock failed payment attempts
      jest
        .spyOn<any, any>(service, 'mockPaymentGateway')
        .mockResolvedValueOnce({ success: false, error: 'Card declined' })
        .mockResolvedValueOnce({ success: false, error: 'Card declined' })
        .mockResolvedValueOnce({ success: false, error: 'Card declined' });

      const result = await service.processPayment({
        orderId: 'order-uuid',
        paymentMethod: PaymentMethod.CARD,
        amount: 500,
      });

      expect(result.status).toBe(PaymentStatus.FAILED);
      // Initial + 3 processing + 3 failed + 1 final failed = 8 saves
      expect(paymentRepository.save).toHaveBeenCalled();
    });

    it('should succeed after retry', async () => {
      paymentRepository.findOne.mockResolvedValue(null);
      paymentRepository.create.mockReturnValue(mockPayment);
      paymentRepository.save.mockResolvedValue(mockPayment as Payment);

      // Mock sleep to avoid delays
      jest.spyOn<any, any>(service, 'sleep').mockResolvedValue(undefined);

      // Fail first, succeed second
      jest
        .spyOn<any, any>(service, 'mockPaymentGateway')
        .mockResolvedValueOnce({ success: false, error: 'Network timeout' })
        .mockResolvedValueOnce({
          success: true,
          transactionId: 'TXN-RETRY-SUCCESS',
        });

      const result = await service.processPayment({
        orderId: 'order-uuid',
        paymentMethod: PaymentMethod.CARD,
        amount: 500,
      });

      expect(result.status).toBe(PaymentStatus.SUCCESS);
      expect(result.transactionId).toBe('TXN-RETRY-SUCCESS');
    });
  });

  describe('getPaymentByOrderId', () => {
    it('should return payment when found', async () => {
      const mockPaymentWithOrder = {
        ...mockPayment,
        order: {} as Order,
      };

      paymentRepository.findOne.mockResolvedValue(mockPaymentWithOrder as Payment);

      const result = await service.getPaymentByOrderId('order-uuid');

      expect(result).toEqual(mockPaymentWithOrder);
      expect(paymentRepository.findOne).toHaveBeenCalledWith({
        where: { orderId: 'order-uuid' },
        relations: ['order'],
      });
    });

    it('should return null when payment not found', async () => {
      paymentRepository.findOne.mockResolvedValue(null);

      const result = await service.getPaymentByOrderId('order-uuid');

      expect(result).toBeNull();
    });
  });

  describe('getPaymentStats', () => {
    it('should return payment statistics', async () => {
      paymentRepository.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(90) // successful
        .mockResolvedValueOnce(5) // failed
        .mockResolvedValueOnce(5); // pending

      const result = await service.getPaymentStats();

      expect(result).toEqual({
        total: 100,
        successful: 90,
        failed: 5,
        pending: 5,
        successRate: 90,
      });
    });

    it('should handle zero payments', async () => {
      paymentRepository.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await service.getPaymentStats();

      expect(result.successRate).toBe(0);
    });
  });

  describe('mockPaymentGateway', () => {
    it('should simulate payment success approximately 90% of time', async () => {
      // Mock sleep to speed up test
      jest.spyOn<any, any>(service, 'sleep').mockResolvedValue(undefined);

      const iterations = 1000;
      let successCount = 0;

      for (let i = 0; i < iterations; i++) {
        const result = await (service as any).mockPaymentGateway();
        if (result.success) {
          successCount++;
          expect(result.transactionId).toBeDefined();
        } else {
          expect(result.error).toBeDefined();
        }
      }

      // Success rate should be around 90% (allow 5% margin)
      const successRate = successCount / iterations;
      expect(successRate).toBeGreaterThan(0.85);
      expect(successRate).toBeLessThan(0.95);
    });

    it('should generate unique transaction IDs', async () => {
      // Mock sleep to speed up test
      jest.spyOn<any, any>(service, 'sleep').mockResolvedValue(undefined);

      const transactionIds = new Set();

      for (let i = 0; i < 100; i++) {
        const result = await (service as any).mockPaymentGateway();
        if (result.success) {
          transactionIds.add(result.transactionId);
        }
      }

      // All transaction IDs should be unique
      expect(transactionIds.size).toBeGreaterThan(0);
    });
  });

  describe('generateTransactionId', () => {
    it('should generate transaction ID in correct format', () => {
      const txnId = (service as any).generateTransactionId();

      expect(txnId).toMatch(/^TXN-\d+-\d{6}$/);
    });

    it('should generate unique transaction IDs', () => {
      const ids = new Set();

      for (let i = 0; i < 100; i++) {
        ids.add((service as any).generateTransactionId());
      }

      expect(ids.size).toBe(100);
    });
  });
});
