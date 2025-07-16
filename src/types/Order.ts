import { z } from 'zod';

export const OrderStatusSchema = z.enum([
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded'
]);

export const SupplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  apiEndpoint: z.string().url(),
  apiKey: z.string(),
  averageShippingDays: z.number(),
  reliability: z.number().min(0).max(1), // 0-1 score
  priceMarkup: z.number(), // Percentage markup from cost
});

export const OrderSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  productId: z.string(),
  supplierId: z.string(),
  status: OrderStatusSchema,
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  totalPrice: z.number().positive(),
  cost: z.number().positive(),
  profit: z.number(),
  orderDate: z.date(),
  shippingAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string(),
  }),
  trackingNumber: z.string().optional(),
  estimatedDelivery: z.date().optional(),
  actualDelivery: z.date().optional(),
  supplierOrderId: z.string().optional(),
  notes: z.string().optional(),
});

export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type Supplier = z.infer<typeof SupplierSchema>;
export type Order = z.infer<typeof OrderSchema>;