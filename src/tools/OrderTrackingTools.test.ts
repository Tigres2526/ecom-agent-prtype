import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderTrackingTools } from './OrderTrackingTools.js';
import { Order, OrderStatus } from '../types/Order.js';

describe('OrderTrackingTools', () => {
  let orderTrackingTools: OrderTrackingTools;

  beforeEach(() => {
    orderTrackingTools = new OrderTrackingTools();
  });

  describe('getTools', () => {
    it('should return all order tracking tools', () => {
      const tools = orderTrackingTools.getTools();
      
      expect(tools).toHaveLength(6);
      expect(tools.map(t => t.name)).toEqual([
        'create_order',
        'update_order_status',
        'get_order_status',
        'track_shipment',
        'get_supplier_performance',
        'bulk_order_status',
      ]);
    });
  });

  describe('create_order', () => {
    it('should create a new order successfully', async () => {
      const createOrderTool = orderTrackingTools.getTools().find(t => t.name === 'create_order');
      const params = {
        customerId: 'CUST-123',
        productId: 'PROD-456',
        supplierId: 'aliexpress',
        quantity: 2,
        unitPrice: 29.99,
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'USA',
        },
      };

      const result = await createOrderTool!.handler(params);

      expect(result.success).toBe(true);
      expect(result.orderId).toMatch(/^ORD-/);
      expect(result.supplierOrderId).toMatch(/^ALIEXPRESS-/);
      expect(result.totalPrice).toBe(59.98);
      expect(result.profit).toBeCloseTo(35.99); // 60% profit margin
      expect(result.estimatedDelivery).toBeInstanceOf(Date);
    });

    it('should fail with invalid supplier', async () => {
      const createOrderTool = orderTrackingTools.getTools().find(t => t.name === 'create_order');
      const params = {
        customerId: 'CUST-123',
        productId: 'PROD-456',
        supplierId: 'invalid-supplier',
        quantity: 1,
        unitPrice: 29.99,
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'USA',
        },
      };

      await expect(createOrderTool!.handler(params)).rejects.toThrow('Supplier invalid-supplier not found');
    });
  });

  describe('update_order_status', () => {
    it('should update order status successfully', async () => {
      // First create an order
      const createOrderTool = orderTrackingTools.getTools().find(t => t.name === 'create_order');
      const createResult = await createOrderTool!.handler({
        customerId: 'CUST-123',
        productId: 'PROD-456',
        supplierId: 'aliexpress',
        quantity: 1,
        unitPrice: 29.99,
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'USA',
        },
      });

      // Then update its status
      const updateStatusTool = orderTrackingTools.getTools().find(t => t.name === 'update_order_status');
      const updateResult = await updateStatusTool!.handler({
        orderId: createResult.orderId,
        status: 'shipped',
        trackingNumber: 'TRACK-123456',
        notes: 'Shipped via express mail',
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.newStatus).toBe('shipped');
      expect(updateResult.trackingNumber).toBe('TRACK-123456');
    });

    it('should set actualDelivery when status is delivered', async () => {
      // Create and update order to delivered
      const createOrderTool = orderTrackingTools.getTools().find(t => t.name === 'create_order');
      const createResult = await createOrderTool!.handler({
        customerId: 'CUST-123',
        productId: 'PROD-456',
        supplierId: 'aliexpress',
        quantity: 1,
        unitPrice: 29.99,
        shippingAddress: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'USA',
        },
      });

      const updateStatusTool = orderTrackingTools.getTools().find(t => t.name === 'update_order_status');
      await updateStatusTool!.handler({
        orderId: createResult.orderId,
        status: 'delivered',
      });

      // Check that actualDelivery was set
      const order = orderTrackingTools.getOrders().get(createResult.orderId);
      expect(order?.actualDelivery).toBeInstanceOf(Date);
    });
  });

  describe('get_order_status', () => {
    it('should retrieve order status successfully', async () => {
      // Create an order
      const createOrderTool = orderTrackingTools.getTools().find(t => t.name === 'create_order');
      const createResult = await createOrderTool!.handler({
        customerId: 'CUST-123',
        productId: 'PROD-456',
        supplierId: 'cjdropshipping',
        quantity: 3,
        unitPrice: 19.99,
        shippingAddress: {
          street: '456 Oak Ave',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90001',
          country: 'USA',
        },
      });

      // Get order status
      const getStatusTool = orderTrackingTools.getTools().find(t => t.name === 'get_order_status');
      const statusResult = await getStatusTool!.handler({
        orderId: createResult.orderId,
      });

      expect(statusResult.orderId).toBe(createResult.orderId);
      expect(statusResult.status).toBe('pending');
      expect(statusResult.supplier).toBe('CJ Dropshipping');
      expect(statusResult.totalPrice).toBe(59.97);
      expect(statusResult.profit).toBeGreaterThan(0);
      expect(statusResult.shippingAddress.street).toBe('456 Oak Ave');
    });
  });

  describe('track_shipment', () => {
    it('should track shipment by tracking number', async () => {
      // Create order and update with tracking number
      const createOrderTool = orderTrackingTools.getTools().find(t => t.name === 'create_order');
      const createResult = await createOrderTool!.handler({
        customerId: 'CUST-123',
        productId: 'PROD-456',
        supplierId: 'spocket',
        quantity: 1,
        unitPrice: 49.99,
        shippingAddress: {
          street: '789 Pine Rd',
          city: 'Chicago',
          state: 'IL',
          zipCode: '60601',
          country: 'USA',
        },
      });

      const updateStatusTool = orderTrackingTools.getTools().find(t => t.name === 'update_order_status');
      await updateStatusTool!.handler({
        orderId: createResult.orderId,
        status: 'shipped',
        trackingNumber: 'SPOCKET-TRACK-789',
      });

      // Track shipment
      const trackShipmentTool = orderTrackingTools.getTools().find(t => t.name === 'track_shipment');
      const trackingResult = await trackShipmentTool!.handler({
        trackingNumber: 'SPOCKET-TRACK-789',
      });

      expect(trackingResult.trackingNumber).toBe('SPOCKET-TRACK-789');
      expect(trackingResult.orderId).toBe(createResult.orderId);
      expect(trackingResult.status).toBe('shipped');
      expect(trackingResult.progress).toMatch(/\d+%/);
      expect(trackingResult.location).toBeTruthy();
      expect(trackingResult.lastUpdate).toBeInstanceOf(Date);
    });
  });

  describe('get_supplier_performance', () => {
    it('should calculate supplier performance metrics', async () => {
      const createOrderTool = orderTrackingTools.getTools().find(t => t.name === 'create_order');
      
      // Create multiple orders for a supplier
      for (let i = 0; i < 5; i++) {
        const result = await createOrderTool!.handler({
          customerId: `CUST-${i}`,
          productId: `PROD-${i}`,
          supplierId: 'aliexpress',
          quantity: 1,
          unitPrice: 30 + i * 5,
          shippingAddress: {
            street: `${i} Test St`,
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'USA',
          },
        });

        // Mark some as delivered
        if (i < 3) {
          const updateStatusTool = orderTrackingTools.getTools().find(t => t.name === 'update_order_status');
          await updateStatusTool!.handler({
            orderId: result.orderId,
            status: 'delivered',
          });
        }
      }

      // Get supplier performance
      const getPerformanceTool = orderTrackingTools.getTools().find(t => t.name === 'get_supplier_performance');
      const performance = await getPerformanceTool!.handler({
        supplierId: 'aliexpress',
      });

      expect(performance.supplierName).toBe('AliExpress API');
      expect(performance.totalOrders).toBe(5);
      expect(performance.completedOrders).toBe(3);
      expect(performance.completionRate).toBe(0.6);
      expect(performance.reliability).toBe(0.85);
      expect(performance.totalRevenue).toBeGreaterThan(0);
      expect(performance.totalProfit).toBeGreaterThan(0);
      expect(performance.profitMargin).toMatch(/\d+\.\d+%/);
    });
  });

  describe('bulk_order_status', () => {
    it('should retrieve status for multiple orders', async () => {
      const createOrderTool = orderTrackingTools.getTools().find(t => t.name === 'create_order');
      const orderIds: string[] = [];

      // Create multiple orders
      for (let i = 0; i < 3; i++) {
        const result = await createOrderTool!.handler({
          customerId: `CUST-${i}`,
          productId: `PROD-${i}`,
          supplierId: 'cjdropshipping',
          quantity: 1,
          unitPrice: 25.99,
          shippingAddress: {
            street: `${i} Bulk St`,
            city: 'Bulk City',
            state: 'BK',
            zipCode: '54321',
            country: 'USA',
          },
        });
        orderIds.push(result.orderId);
      }

      // Update some order statuses
      const updateStatusTool = orderTrackingTools.getTools().find(t => t.name === 'update_order_status');
      await updateStatusTool!.handler({
        orderId: orderIds[0],
        status: 'processing',
      });
      await updateStatusTool!.handler({
        orderId: orderIds[1],
        status: 'shipped',
        trackingNumber: 'BULK-TRACK-001',
      });

      // Get bulk status
      const bulkStatusTool = orderTrackingTools.getTools().find(t => t.name === 'bulk_order_status');
      const bulkResult = await bulkStatusTool!.handler({
        orderIds,
      });

      expect(bulkResult.orders).toHaveLength(3);
      expect(bulkResult.summary.total).toBe(3);
      expect(bulkResult.summary.pending).toBe(1);
      expect(bulkResult.summary.processing).toBe(1);
      expect(bulkResult.summary.shipped).toBe(1);
      expect(bulkResult.orders[1].trackingNumber).toBe('BULK-TRACK-001');
    });

    it('should handle non-existent orders', async () => {
      const bulkStatusTool = orderTrackingTools.getTools().find(t => t.name === 'bulk_order_status');
      const bulkResult = await bulkStatusTool!.handler({
        orderIds: ['FAKE-ORDER-1', 'FAKE-ORDER-2'],
      });

      expect(bulkResult.orders).toHaveLength(2);
      expect(bulkResult.orders[0].error).toBe('Order not found');
      expect(bulkResult.orders[1].error).toBe('Order not found');
      expect(bulkResult.summary.total).toBe(2);
    });
  });

  describe('supplier initialization', () => {
    it('should initialize with demo suppliers', () => {
      const suppliers = orderTrackingTools.getSuppliers();
      
      expect(suppliers.size).toBe(3);
      expect(suppliers.has('aliexpress')).toBe(true);
      expect(suppliers.has('cjdropshipping')).toBe(true);
      expect(suppliers.has('spocket')).toBe(true);
      
      const aliexpress = suppliers.get('aliexpress');
      expect(aliexpress?.name).toBe('AliExpress API');
      expect(aliexpress?.averageShippingDays).toBe(15);
      expect(aliexpress?.reliability).toBe(0.85);
    });
  });
});