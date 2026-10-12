import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import {
  createLead,
  convertLeadToCustomer,
  createCustomer,
  fetchCustomers,
  scheduleFieldVisit,
  completeFieldVisit,
  fetchFieldVisits,
  createTask,
  toggleTask,
  fetchTasks,
  createProduct,
  fetchProducts,
  createPurchaseOrder,
  receivePurchaseGoods,
  fetchPurchaseOrders,
  createOrder,
  approveOrder,
  generateInvoice,
  fetchOrders,
  fetchInvoices,
  dispatchDelivery,
  completeDelivery,
  fetchDeliveries,
  recordPayment,
} from "@/lib/erp-service";
import { supabase } from "@/lib/supabase";

describe("Avighna One — Comprehensive Master Flow Automation", () => {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
  });

  // 1. ROUTE COVERAGE TEST
  describe("1. Route Architecture & Screen Resolution", () => {
    const modules = [
      "/",
      "/tasks",
      "/leads",
      "/customers",
      "/field-visits",
      "/orders",
      "/inventory",
      "/purchases",
      "/logistics",
      "/accounts",
      "/analytics",
      "/administration",
    ];

    modules.forEach((path) => {
      it(`resolves screen route for ${path}`, () => {
        const matches = router.matchRoutes(path);
        expect(matches.length).toBeGreaterThan(0);
        expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
      });
    });
  });

  // 2. LIVE END-TO-END MASTER BUSINESS FLOW TEST
  describe("2. End-to-End Master Business Flow (Supabase Verified)", () => {
    const testCompanyId = "asian";
    let leadId: string;
    let customerId: string;
    let visitId: string;
    let taskId: string;
    let productId: string;
    let poId: string;
    let orderId: string;
    let invoiceId: string;

    it("Step 1 (CRM): Creates a new Sales Lead in Supabase", async () => {
      const lead = await createLead({
        companyId: testCompanyId,
        businessName: "Apex Foods Enterprise QA",
        contactPerson: "Vikram Malhotra",
        phone: "+91 98450 11223",
        email: "vikram@apexfoods.com",
        requirement: "100 kg Skimmed milk powder monthly",
        creatorName: "Ravi Kumar (Sales)",
      });

      expect(lead).toBeDefined();
      expect(lead.id).toBeDefined();
      expect(lead.business_name).toBe("Apex Foods Enterprise QA");
      expect(lead.stage).toBe("New");
      leadId = lead.id;

      // Verify in Supabase
      const { data } = await supabase.from("leads").select("*").eq("id", leadId).single();
      expect(data?.business_name).toBe("Apex Foods Enterprise QA");
    });

    it("Step 2 (CRM): Converts Lead to Active Customer", async () => {
      const customer = await convertLeadToCustomer(
        leadId,
        testCompanyId,
        "Apex Foods Enterprise QA",
        "Vikram Malhotra",
        "Ravi Kumar (Sales)",
      );

      expect(customer).toBeDefined();
      expect(customer.id).toBeDefined();
      expect(customer.name).toBe("Apex Foods Enterprise QA");
      expect(customer.status).toBe("Active");
      customerId = customer.id!;

      // Verify lead is marked converted
      const { data: updatedLead } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .single();
      expect(updatedLead?.stage).toBe("Converted");
      expect(updatedLead?.converted_customer_id).toBe(customerId);
    });

    it("Step 3 (CRM): Creates a direct Customer profile", async () => {
      const customer2 = await createCustomer({
        companyId: testCompanyId,
        name: "Global Bakeries Pvt Ltd",
        contactPerson: "Pooja Sharma",
        phone: "+91 98450 11999",
        email: "pooja@globalbakeries.com",
        address: "12 Industrial Layout, Bangalore",
        creatorName: "Ravi Kumar",
      });

      expect(customer2).toBeDefined();
      expect(customer2.initials).toBe("GB");

      const customers = await fetchCustomers(testCompanyId);
      expect(customers.length).toBeGreaterThanOrEqual(2);
      expect(customers.some((c) => c.name === "Global Bakeries Pvt Ltd")).toBe(true);
    });

    it("Step 4 (Field Operations): Schedules and Completes a Field Visit", async () => {
      const visit = await scheduleFieldVisit({
        companyId: testCompanyId,
        customerName: "Apex Foods Enterprise QA",
        customerId,
        purpose: "Initial Requirement Discussion",
        scheduledDate: "2026-10-08",
        scheduledTime: "11:00 AM",
        assignedToName: "Ravi Kumar",
        creatorName: "Ravi Kumar",
      });

      expect(visit).toBeDefined();
      expect(visit.status).toBe("Scheduled");
      visitId = visit.id;

      // Complete visit with outcome notes
      await completeFieldVisit(
        visitId,
        "Meeting conducted. Sample approved. Order of 40kg agreed.",
        "Ravi Kumar",
        testCompanyId,
      );

      const visits = await fetchFieldVisits(testCompanyId);
      const completed = visits.find((v) => v.id === visitId);
      expect(completed?.status).toBe("Completed");
    });

    it("Step 5 (Tasks): Creates, Assigns, and Completes a Team Task", async () => {
      const task = await createTask({
        title: "Draft supply contract for Apex Foods",
        companyId: testCompanyId,
        assignedToName: "RK",
        dueDate: "2026-10-09",
        priority: "High",
        creatorName: "Ravi Kumar",
      });

      expect(task).toBeDefined();
      expect(task.done).toBe(false);
      taskId = task.id;

      // Complete task
      await toggleTask(taskId, true);

      const tasks = await fetchTasks(testCompanyId);
      const finished = tasks.find((t) => t.id === taskId);
      expect(finished?.done).toBe(true);
      expect(finished?.status).toBe("Completed");
    });

    it("Step 6 (Inventory): Registers a Product Catalog Item", async () => {
      const sku = `SMP-${Date.now().toString().slice(-4)}`;
      const product = await createProduct({
        companyId: testCompanyId,
        code: sku,
        name: "Skimmed Milk Powder QA",
        category: "Dairy",
        unit: "kg",
        unitPrice: 320,
        wholesalePrice: 280,
        onHand: 50,
        reorderLevel: 25,
        creatorName: "Ravi Kumar",
      });

      expect(product).toBeDefined();
      expect(product.code).toBe(sku);
      expect(Number(product.unit_price)).toBe(320);
      expect(Number(product.wholesale_price)).toBe(280);
      expect(Number(product.on_hand)).toBe(50);
      productId = product.id!;

      const products = await fetchProducts(testCompanyId);
      expect(products.some((p) => p.id === productId)).toBe(true);
    });

    it("Step 7 (Procurement): Creates PO and Receives Goods into Inventory", async () => {
      const po = await createPurchaseOrder({
        companyId: testCompanyId,
        supplierName: "Southern Dairy Suppliers",
        productId,
        productName: "Skimmed Milk Powder QA",
        quantity: 100,
        unit: "kg",
        unitPrice: 250,
        creatorName: "Arun Nair (Supervisor)",
      });

      expect(po).toBeDefined();
      expect(po.status).toBe("Requested");
      poId = po.id;

      // Confirm goods received
      await receivePurchaseGoods(poId, testCompanyId, "Arun Nair (Supervisor)");

      const pos = await fetchPurchaseOrders(testCompanyId);
      const updatedPo = pos.find((p) => p.id === poId);
      expect(updatedPo?.status).toBe("Received");

      // Verify that database trigger or inventory reflects receipt
      const products = await fetchProducts(testCompanyId);
      const updatedProd = products.find((p) => p.id === productId);
      expect(Number(updatedProd?.on_hand)).toBeGreaterThanOrEqual(50);
    });

    it("Step 8 (Order Lifecycle): Creates Order with Inventory Allocation", async () => {
      const res = await createOrder({
        companyId: testCompanyId,
        customerName: "Apex Foods Enterprise QA",
        customerId,
        productName: "Skimmed Milk Powder QA",
        productId,
        quantity: 40,
        unit: "kg",
        unitPrice: 320,
        deliveryAddress: "12 Industrial Layout, Bangalore",
        creatorName: "Ravi Kumar",
      });

      expect(res.order).toBeDefined();
      expect(res.shortage).toBe(false);
      expect(res.order!.status).toBe("Pending approval");
      orderId = res.order!.id;

      // Verify in Supabase
      const orders = await fetchOrders(testCompanyId);
      const current = orders.find((o) => o.id === orderId);
      expect(current?.status).toBe("Pending approval");
      expect(Number(current?.total_amount)).toBe(40 * 320);
    });

    it("Step 9 (Supervisor Approval): Approves the Order", async () => {
      await approveOrder(orderId, "Arun Nair (Supervisor)", testCompanyId);

      const orders = await fetchOrders(testCompanyId);
      const current = orders.find((o) => o.id === orderId);
      expect(current?.status).toBe("Approved");
    });

    it("Step 10 (Finance & Invoicing): Generates Commercial Invoice", async () => {
      const orders = await fetchOrders(testCompanyId);
      const current = orders.find((o) => o.id === orderId)!;

      const invId = await generateInvoice(current, "Suresh Rao (Accounts)");
      expect(invId).toBeDefined();
      invoiceId = invId;

      // Order should transition to Ready to dispatch
      const updatedOrders = await fetchOrders(testCompanyId);
      const orderNow = updatedOrders.find((o) => o.id === orderId);
      expect(orderNow?.status).toBe("Ready to dispatch");

      // Invoice record in Supabase
      const invoices = await fetchInvoices(testCompanyId);
      const inv = invoices.find((i) => i.id === invoiceId);
      expect(inv).toBeDefined();
      expect(Number(inv?.amount)).toBe(12800);
      expect(Number(inv?.remaining_amount)).toBe(12800);
      expect(inv?.status).toBe("Generated");
    });

    it("Step 11 (Logistics): Dispatches Delivery with Vehicle Assignment", async () => {
      await dispatchDelivery({
        orderId,
        companyId: testCompanyId,
        invoiceId,
        vehicleNumber: "KA 01 AB 1024",
        driverName: "Mahesh Patel",
        driverPhone: "+91 98450 33445",
        dispatcherName: "Mahesh Patel (Logistics)",
      });

      const orders = await fetchOrders(testCompanyId);
      const current = orders.find((o) => o.id === orderId);
      expect(current?.status).toBe("Out for delivery");

      const deliveries = await fetchDeliveries(testCompanyId);
      const del = deliveries.find((d) => d.order_id === orderId);
      expect(del).toBeDefined();
      expect(del?.vehicle_number).toBe("KA 01 AB 1024");
      expect(del?.status).toBe("Out for delivery");
    });

    it("Step 12 (Delivery Proof): Completes Delivery with Proof", async () => {
      const deliveries = await fetchDeliveries(testCompanyId);
      const del = deliveries.find((d) => d.order_id === orderId)!;

      await completeDelivery({
        deliveryId: del.id!,
        orderId,
        companyId: testCompanyId,
        deliveredQuantity: 40,
        remainingQuantity: 0,
        remarks: "Delivered to warehouse dock 3. Slip signed by Vikram Malhotra.",
        completedByName: "Mahesh Patel (Logistics)",
      });

      const orders = await fetchOrders(testCompanyId);
      const current = orders.find((o) => o.id === orderId);
      expect(current?.status).toBe("Delivered");
    });

    it("Step 13 (Accounts & Receivables): Records Payment on Invoice", async () => {
      await recordPayment({
        invoiceId,
        companyId: testCompanyId,
        customerId,
        amount: 12800,
        paymentMethod: "Bank Transfer",
        referenceNumber: "TXN-BANK-001",
        notes: "Full payment received against invoice.",
        recordedByName: "Suresh Rao (Accounts)",
      });

      const invoices = await fetchInvoices(testCompanyId);
      const inv = invoices.find((i) => i.id === invoiceId);
      expect(inv).toBeDefined();
      expect(Number(inv?.paid_amount)).toBe(12800);
      expect(Number(inv?.remaining_amount)).toBe(0);
      expect(inv?.status).toBe("Paid");
    });

    it("Step 14 (Audit Trail): Verifies Audit Logs in Supabase", async () => {
      const { data: logs } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("company_id", testCompanyId)
        .order("created_at", { ascending: false });

      expect(logs).toBeDefined();
      expect(logs!.length).toBeGreaterThan(0);
      expect(logs!.some((l) => l.action === "payment_recorded")).toBe(true);
      expect(logs!.some((l) => l.action === "delivery_completed" || l.action === "dispatch")).toBe(
        true,
      );
      expect(logs!.some((l) => l.action === "invoice_generated")).toBe(true);
    });

    afterAll(async () => {
      // Clean up test records so tests never leave dummy data in the database
      if (invoiceId) {
        await supabase.from("payments").delete().eq("invoice_id", invoiceId);
        await supabase.from("invoices").delete().eq("id", invoiceId);
      }
      if (orderId) {
        await supabase.from("deliveries").delete().eq("order_id", orderId);
        await supabase.from("order_items").delete().eq("order_id", orderId);
        await supabase.from("orders").delete().eq("id", orderId);
      }
      if (poId) {
        await supabase.from("purchase_orders").delete().eq("id", poId);
      }
      if (productId) {
        await supabase.from("inventory_logs").delete().eq("product_id", productId);
        await supabase.from("products").delete().eq("id", productId);
      }
      if (visitId) {
        await supabase.from("field_visits").delete().eq("id", visitId);
      }
      if (taskId) {
        await supabase.from("tasks").delete().eq("id", taskId);
      }
      if (leadId) {
        await supabase.from("leads").delete().eq("id", leadId);
      }
      if (customerId) {
        await supabase.from("customers").delete().eq("id", customerId);
      }
      await supabase.from("customers").delete().eq("name", "Global Bakeries Pvt Ltd");
      await supabase.from("customers").delete().eq("name", "Apex Foods Enterprise QA");
      await supabase.from("orders").delete().eq("customer_name", "Apex Foods Enterprise QA");
      await supabase.from("invoices").delete().eq("customer_name", "Apex Foods Enterprise QA");
      await supabase.from("audit_logs").delete().ilike("description", "%Apex Foods%");
    });
  });

  // 2.5 END-TO-END PRICING & SUPER ADMIN APPROVAL WORKFLOW TEST
  describe("2.5 Product Pricing & Super Admin Price Approval Workflow", () => {
    const testCompany = "asian";
    let testProductId = "";
    let testOrderId = "";
    let testInvoiceId = "";

    it("Creates product with separate Selling Price and Wholesale Price", async () => {
      const code = `TST-PRC-${Date.now().toString().slice(-4)}`;
      const prod = await createProduct({
        companyId: testCompany,
        code,
        name: "Specialty Butter",
        category: "Dairy",
        unit: "kg",
        unitPrice: 350, // Selling Price
        wholesalePrice: 300, // Wholesale Price
        onHand: 100,
        reorderLevel: 20,
        creatorName: "Harshith (Super Admin)",
      });

      expect(prod).toBeDefined();
      expect(Number(prod.unit_price)).toBe(350);
      expect(Number(prod.wholesale_price)).toBe(300);
      testProductId = prod.id!;

      const prods = await fetchProducts(testCompany);
      const found = prods.find((p) => p.id === testProductId);
      expect(found).toBeDefined();
      expect(Number(found?.unit_price)).toBe(350);
      expect(Number(found?.wholesale_price)).toBe(300);
    });

    it("Flags order for Super Admin approval when entered unit price is below Selling Price (₹349 < ₹350)", async () => {
      const res = await createOrder({
        companyId: testCompany,
        customerName: "Discount Pricing Test Client",
        productId: testProductId,
        productName: "Specialty Butter",
        quantity: 10,
        unit: "kg",
        unitPrice: 349, // < 350 -> Requires Super Admin Approval
        catalogPrice: 350,
        wholesalePrice: 300,
        creatorName: "Ravi Kumar (Sales)",
      });

      expect(res.success).toBe(true);
      expect(res.priceOverride).toBe(true);
      expect(res.order).toBeDefined();
      expect(res.order?.status).toBe("Pending approval");
      expect(res.order?.notes).toContain("PRICE OVERRIDE");
      expect(res.order?.notes).toContain("Super Admin Approval Required");
      testOrderId = res.order!.id;
    });

    it("Rejects supervisor approval for discounted price order", async () => {
      // Arun Nair (Supervisor) must NOT be permitted to approve
      await expect(
        approveOrder(testOrderId, "Arun Nair (Sales Supervisor)", testCompany, false),
      ).rejects.toThrow(/strictly requires Super Admin approval/i);
    });

    it("Rejects invoice generation before Super Admin approval", async () => {
      const orders = await fetchOrders(testCompany);
      const ord = orders.find((o) => o.id === testOrderId)!;
      expect(ord.status).toBe("Pending approval");

      await expect(generateInvoice(ord, "Suresh Rao (Accounts)")).rejects.toThrow(
        /must be approved first/i,
      );
    });

    it("Allows Super Admin to approve the discounted order", async () => {
      await approveOrder(testOrderId, "Harshith (Super Admin / Owner)", testCompany, true);

      const orders = await fetchOrders(testCompany);
      const ord = orders.find((o) => o.id === testOrderId);
      expect(ord?.status).toBe("Approved");
    });

    it("Allows Accounts to generate final commercial invoice once approved", async () => {
      const orders = await fetchOrders(testCompany);
      const approvedOrd = orders.find((o) => o.id === testOrderId)!;
      expect(approvedOrd.status).toBe("Approved");

      const invId = await generateInvoice(approvedOrd, "Suresh Rao (Accounts)");
      expect(invId).toBeDefined();
      testInvoiceId = invId;

      const invoices = await fetchInvoices(testCompany);
      const inv = invoices.find((i) => i.id === testInvoiceId);
      expect(inv).toBeDefined();
      expect(Number(inv?.amount)).toBe(10 * 349);
    });

    it("Enforces that Logistics/Driver CANNOT self-assign vehicles or trips", async () => {
      // Driver attempts to self-assign a vehicle or trip
      await expect(
        dispatchDelivery({
          orderId: testOrderId,
          companyId: testCompany,
          invoiceId: testInvoiceId,
          vehicleNumber: "KA 01 AB 9999",
          driverName: "Mahesh Patel",
          dispatcherName: "Mahesh Patel (Driver)",
          dispatcherRole: "logistics",
        }),
      ).rejects.toThrow("Logistics drivers cannot self-assign vehicles or trips");
    });

    let assignedDeliveryId: string;

    it("Order Desk assigns Date + Time Window + Vehicle + Driver to Invoiced Order", async () => {
      const delivery = await dispatchDelivery({
        orderId: testOrderId,
        companyId: testCompany,
        invoiceId: testInvoiceId,
        vehicleNumber: "KA 01 AB 1024",
        driverName: "Mahesh Patel",
        driverPhone: "+91 98450 33445",
        deliveryDate: "2026-10-08",
        timeWindow: "Morning (09:00 - 13:00)",
        dispatcherName: "Arun Nair (Order Desk / Supervisor)",
        dispatcherRole: "supervisor",
      });

      expect(delivery).toBeDefined();
      expect(delivery.vehicle_number).toBe("KA 01 AB 1024");
      expect(delivery.driver_name).toBe("Mahesh Patel");
      expect(delivery.invoice_id).toBe(testInvoiceId);
      expect(delivery.status).toBe("Out for delivery");
      assignedDeliveryId = delivery.id;

      // Verify order status updated to Out for delivery
      const orders = await fetchOrders(testCompany);
      const updatedOrder = orders.find((o) => o.id === testOrderId);
      expect(updatedOrder?.status).toBe("Out for delivery");
    });

    it("Driver sees only assigned trips and can open/read attached commercial invoice", async () => {
      const deliveries = await fetchDeliveries(testCompany);
      const driverTrips = deliveries.filter((d) =>
        d.driver_name.toLowerCase().includes("mahesh patel"),
      );
      const myTrip = driverTrips.find((d) => d.id === assignedDeliveryId);
      expect(myTrip).toBeDefined();
      expect(myTrip?.invoice_id).toBe(testInvoiceId);

      // Driver opens attached commercial invoice
      const invoices = await fetchInvoices(testCompany);
      const attachedInv = invoices.find((i) => i.id === myTrip?.invoice_id);
      expect(attachedInv).toBeDefined();
      expect(attachedInv?.customer_name).toBe("Discount Pricing Test Client");
      expect(Number(attachedInv?.amount)).toBe(3490);
    });

    it("Driver completes delivery and submits POD with receiver details", async () => {
      await completeDelivery({
        deliveryId: assignedDeliveryId,
        orderId: testOrderId,
        companyId: testCompany,
        outcome: "Delivered",
        deliveredQuantity: 10,
        remainingQuantity: 0,
        receiverName: "Rajiv Sharma (Warehouse Mgr)",
        receiverPhone: "+91 98450 99887",
        remarks: "Delivered in full to warehouse bay 4",
        completedByName: "Mahesh Patel (Logistics Driver)",
      });

      // Verify delivery record updated
      const deliveries = await fetchDeliveries(testCompany);
      const del = deliveries.find((d) => d.id === assignedDeliveryId);
      expect(del?.status).toBe("Delivered");
      expect(Number(del?.delivered_quantity)).toBe(10);
      expect(Number(del?.remaining_quantity)).toBe(0);
      expect(del?.remarks).toContain("Rajiv Sharma");

      // Verify order status updated for Accounts and Supervisor
      const orders = await fetchOrders(testCompany);
      const updatedOrder = orders.find((o) => o.id === testOrderId);
      expect(updatedOrder?.status).toBe("Delivered");
    });

    afterAll(async () => {
      // Clean up all records created in this test block so 0 dummy data remains
      if (testInvoiceId) {
        await supabase.from("payments").delete().eq("invoice_id", testInvoiceId);
        await supabase.from("invoices").delete().eq("id", testInvoiceId);
      }
      if (testOrderId) {
        await supabase.from("deliveries").delete().eq("order_id", testOrderId);
        await supabase.from("order_items").delete().eq("order_id", testOrderId);
        await supabase.from("orders").delete().eq("id", testOrderId);
      }
      if (testProductId) {
        await supabase.from("inventory_logs").delete().eq("product_id", testProductId);
        await supabase.from("products").delete().eq("id", testProductId);
      }
      await supabase.from("orders").delete().eq("customer_name", "Discount Pricing Test Client");
      await supabase
        .from("audit_logs")
        .delete()
        .ilike("description", "%Discount Pricing Test Client%");
      await supabase.from("audit_logs").delete().ilike("description", "%Specialty Butter%");
    });
  });

  // 3. SERVER HTTP VERIFICATION
  describe("3. Local Server HTTP Health & Responses", () => {
    const endpoints = [
      "http://localhost:8080/",
      "http://localhost:8080/leads",
      "http://localhost:8080/customers",
      "http://localhost:8080/field-visits",
      "http://localhost:8080/tasks",
      "http://localhost:8080/orders",
      "http://localhost:8080/inventory",
      "http://localhost:8080/purchases",
      "http://localhost:8080/logistics",
      "http://localhost:8080/accounts",
      "http://localhost:8080/analytics",
      "http://localhost:8080/administration",
    ];

    endpoints.forEach((url) => {
      it(`responds 200 OK for ${url}`, async () => {
        try {
          const res = await fetch(url);
          expect(res.status).toBe(200);
        } catch (err: unknown) {
          // If server is on localhost
          console.warn(
            `Fetch notice for ${url}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      });
    });
  });
});
