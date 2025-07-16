import { z } from 'zod';
import { Order, OrderStatus, Supplier, OrderSchema, SupplierSchema } from '../types/Order.js';
import { AgentTool } from '../types/index.js';

export class OrderTrackingTools {
  private orders: Map<string, Order> = new Map();
  private suppliers: Map<string, Supplier> = new Map();

  constructor() {
    // Initialize with some demo suppliers
    this.initializeDemoSuppliers();
  }

  private initializeDemoSuppliers(): void {
    const demoSuppliers: Supplier[] = [
      {
        id: 'aliexpress',
        name: 'AliExpress API',
        apiEndpoint: 'https://api.aliexpress.com/v1',
        apiKey: 'demo-key',
        averageShippingDays: 15,
        reliability: 0.85,
        priceMarkup: 2.5
      },
      {
        id: 'cjdropshipping',
        name: 'CJ Dropshipping',
        apiEndpoint: 'https://api.cjdropshipping.com/v2',
        apiKey: 'demo-key',
        averageShippingDays: 12,
        reliability: 0.90,
        priceMarkup: 2.2
      },
      {
        id: 'spocket',
        name: 'Spocket',
        apiEndpoint: 'https://api.spocket.co/v1',
        apiKey: 'demo-key',
        averageShippingDays: 7,
        reliability: 0.95,
        priceMarkup: 3.0
      }
    ];

    demoSuppliers.forEach(supplier => {
      this.suppliers.set(supplier.id, supplier);
    });
  }

  getTools(): AgentTool[] {
    return [
      {
        type: 'function',
        function: {
          name: 'create_order',
          description: 'Create a new order with a supplier',
          parameters: {
            type: 'object',
            properties: {
              customerId: { type: 'string' },
              productId: { type: 'string' },
              supplierId: { type: 'string' },
              quantity: { type: 'number' },
              unitPrice: { type: 'number' },
              shippingAddress: {
                type: 'object',
                properties: {
                  street: { type: 'string' },
                  city: { type: 'string' },
                  state: { type: 'string' },
                  zipCode: { type: 'string' },
                  country: { type: 'string' },
                },
                required: ['street', 'city', 'state', 'zipCode', 'country']
              },
            },
            required: ['customerId', 'productId', 'supplierId', 'quantity', 'unitPrice', 'shippingAddress']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'update_order_status',
          description: 'Update the status of an existing order',
          parameters: {
            type: 'object',
            properties: {
              orderId: { type: 'string' },
              status: { type: 'string', enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'] },
              trackingNumber: { type: 'string' },
              notes: { type: 'string' },
            },
            required: ['orderId', 'status']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_order_status',
          description: 'Get the current status and details of an order',
          parameters: {
            type: 'object',
            properties: {
              orderId: { type: 'string' },
            },
            required: ['orderId']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'track_shipment',
          description: 'Track a shipment using the tracking number',
          parameters: {
            type: 'object',
            properties: {
              trackingNumber: { type: 'string' },
            },
            required: ['trackingNumber']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_supplier_performance',
          description: 'Get performance metrics for a supplier',
          parameters: {
            type: 'object',
            properties: {
              supplierId: { type: 'string' },
              dateRange: {
                type: 'object',
                properties: {
                  start: { type: 'string' },
                  end: { type: 'string' },
                },
                required: ['start', 'end']
              },
            },
            required: ['supplierId']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'bulk_order_status',
          description: 'Get status of multiple orders at once',
          parameters: {
            type: 'object',
            properties: {
              orderIds: { type: 'array', items: { type: 'string' } },
            },
            required: ['orderIds']
          }
        }
      },
    ];
  }

  public async createOrder(params: {
    customerId: string;
    productId: string;
    supplierId: string;
    quantity: number;
    unitPrice: number;
    shippingAddress: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  }): Promise<any> {
    const supplier = this.suppliers.get(params.supplierId);
    if (!supplier) {
      throw new Error(`Supplier ${params.supplierId} not found`);
    }

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const cost = params.unitPrice / supplier.priceMarkup;
    const totalPrice = params.unitPrice * params.quantity;
    const totalCost = cost * params.quantity;

    const order: Order = {
      id: orderId,
      customerId: params.customerId,
      productId: params.productId,
      supplierId: params.supplierId,
      status: 'pending',
      quantity: params.quantity,
      unitPrice: params.unitPrice,
      totalPrice,
      cost: totalCost,
      profit: totalPrice - totalCost,
      orderDate: new Date(),
      shippingAddress: params.shippingAddress,
      estimatedDelivery: new Date(Date.now() + supplier.averageShippingDays * 24 * 60 * 60 * 1000),
    };

    this.orders.set(orderId, order);

    // Simulate API call to supplier
    const supplierOrderId = await this.placeOrderWithSupplier(order, supplier);
    order.supplierOrderId = supplierOrderId;

    return {
      success: true,
      orderId,
      supplierOrderId,
      estimatedDelivery: order.estimatedDelivery,
      totalPrice,
      profit: order.profit,
    };
  }

  private async placeOrderWithSupplier(order: Order, supplier: Supplier): Promise<string> {
    // Simulate API call to supplier
    // In production, this would make actual API calls to supplier endpoints
    const delay = process.env.NODE_ENV === 'test' ? 10 : 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Simulate occasional failures based on supplier reliability
    // Check for test environment to avoid random failures in tests
    if (process.env.NODE_ENV !== 'test' && Math.random() > supplier.reliability) {
      throw new Error(`Failed to place order with ${supplier.name}`);
    }

    return `${supplier.id.toUpperCase()}-${Date.now()}`;
  }

  public async updateOrderStatus(params: {
    orderId: string;
    status: OrderStatus;
    trackingNumber?: string;
    notes?: string;
  }): Promise<any> {
    const order = this.orders.get(params.orderId);
    if (!order) {
      throw new Error(`Order ${params.orderId} not found`);
    }

    order.status = params.status;
    if (params.trackingNumber) {
      order.trackingNumber = params.trackingNumber;
    }
    if (params.notes) {
      order.notes = (order.notes || '') + '\\n' + params.notes;
    }

    if (params.status === 'delivered') {
      order.actualDelivery = new Date();
    }

    return {
      success: true,
      orderId: order.id,
      newStatus: order.status,
      trackingNumber: order.trackingNumber,
    };
  }

  public async getOrderStatus(params: { orderId: string }): Promise<any> {
    const order = this.orders.get(params.orderId);
    if (!order) {
      throw new Error(`Order ${params.orderId} not found`);
    }

    const supplier = this.suppliers.get(order.supplierId);

    return {
      orderId: order.id,
      status: order.status,
      trackingNumber: order.trackingNumber,
      orderDate: order.orderDate,
      estimatedDelivery: order.estimatedDelivery,
      actualDelivery: order.actualDelivery,
      supplier: supplier?.name,
      totalPrice: order.totalPrice,
      profit: order.profit,
      shippingAddress: order.shippingAddress,
    };
  }

  public async trackShipment(params: { trackingNumber: string }): Promise<any> {
    // Find order by tracking number
    const order = Array.from(this.orders.values()).find(
      o => o.trackingNumber === params.trackingNumber
    );

    if (!order) {
      throw new Error(`No order found with tracking number ${params.trackingNumber}`);
    }

    // Simulate tracking update
    const mockLocations = [
      'Package received at origin facility',
      'In transit to destination country',
      'Arrived at destination country',
      'Out for delivery',
      'Delivered'
    ];

    const progress = order.status === 'delivered' ? 100 : 
                    order.status === 'shipped' ? Math.floor(Math.random() * 60) + 20 : 0;

    return {
      trackingNumber: params.trackingNumber,
      orderId: order.id,
      status: order.status,
      progress: `${progress}%`,
      lastUpdate: new Date(),
      location: mockLocations[Math.floor(progress / 20)],
      estimatedDelivery: order.estimatedDelivery,
    };
  }

  public async getSupplierPerformance(params: {
    supplierId: string;
    dateRange?: { start: string; end: string };
  }): Promise<any> {
    const supplier = this.suppliers.get(params.supplierId);
    if (!supplier) {
      throw new Error(`Supplier ${params.supplierId} not found`);
    }

    // Calculate performance metrics
    const supplierOrders = Array.from(this.orders.values()).filter(
      (o: Order) => o.supplierId === params.supplierId
    );

    const completedOrders = supplierOrders.filter((o: Order) => o.status === 'delivered');
    const cancelledOrders = supplierOrders.filter((o: Order) => o.status === 'cancelled');
    
    const avgDeliveryTime = completedOrders.length > 0
      ? completedOrders.reduce((sum: number, order: Order) => {
          if (order.actualDelivery && order.orderDate) {
            return sum + (order.actualDelivery.getTime() - order.orderDate.getTime()) / (1000 * 60 * 60 * 24);
          }
          return sum;
        }, 0) / completedOrders.length
      : supplier.averageShippingDays;

    const totalRevenue = supplierOrders.reduce((sum: number, o: Order) => sum + o.totalPrice, 0);
    const totalProfit = supplierOrders.reduce((sum: number, o: Order) => sum + o.profit, 0);

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      totalOrders: supplierOrders.length,
      completedOrders: completedOrders.length,
      cancelledOrders: cancelledOrders.length,
      completionRate: supplierOrders.length > 0 ? completedOrders.length / supplierOrders.length : 0,
      averageDeliveryDays: avgDeliveryTime.toFixed(1),
      reliability: supplier.reliability,
      totalRevenue,
      totalProfit,
      profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue * 100).toFixed(2) + '%' : '0%',
    };
  }

  public async bulkOrderStatus(params: { orderIds: string[] }): Promise<any> {
    const results = params.orderIds.map((orderId: string) => {
      const order = this.orders.get(orderId);
      if (!order) {
        return { orderId, error: 'Order not found' };
      }
      return {
        orderId,
        status: order.status,
        trackingNumber: order.trackingNumber,
        estimatedDelivery: order.estimatedDelivery,
      };
    });

    return {
      orders: results,
      summary: {
        total: results.length,
        pending: results.filter(r => r.status === 'pending').length,
        processing: results.filter(r => r.status === 'processing').length,
        shipped: results.filter(r => r.status === 'shipped').length,
        delivered: results.filter(r => r.status === 'delivered').length,
      }
    };
  }

  // Public method to access orders for testing
  getOrders(): Map<string, Order> {
    return this.orders;
  }

  // Public method to access suppliers
  getSuppliers(): Map<string, Supplier> {
    return this.suppliers;
  }
}