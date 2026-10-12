import { describe, it, expect, beforeEach } from "vitest";
import {
  fetchVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  updateVehicleStatus,
  assignOrderVehicle,
  createOrder,
  fetchAuditLogs,
  DBVehicle,
} from "../lib/erp-service";

describe("Vehicle Fleet & Real Transport Dispatch Workflow", { timeout: 20000 }, () => {
  let testVehicle: DBVehicle;

  beforeEach(async () => {
    // Ensure we start with a fresh test vehicle
    testVehicle = await createVehicle(
      {
        name: "Ashok Leyland Dost",
        plateNumber: `KA-04-TEST-${Math.floor(1000 + Math.random() * 9000)}`,
        capacity: "2.0 Tons",
        status: "Available / At Godown",
        driverName: "Suresh Gowda",
        driverPhone: "+91 98450 99999",
        companyId: "asian",
      },
      "Super Admin",
    );
  });

  describe("1. Manufacturer Vehicle Path", () => {
    it("creates an order tracked as Manufacturer Vehicle without requiring company fleet assignment", async () => {
      const res = await createOrder({
        companyId: "asian",
        customerName: "Modern Infrastructure Ltd",
        productName: "Birla Super 53 Grade Cement",
        quantity: 50,
        unitPrice: 380,
        creatorName: "Priya Sharma (Sales)",
        transportMode: "Manufacturer Vehicle",
        assignedDriver: "Raghu (Manufacturer Rep)",
        assignedDriverPhone: "+91 98888 11111",
      });

      if (!res.success) console.error("createOrder error:", res.error);
      expect(res.success).toBe(true);
      const order = res.order!;
      expect(order.transport_mode).toBe("Manufacturer Vehicle");
      expect(order.assigned_vehicle).toBe("Manufacturer Arranged");
      expect(order.assigned_driver).toBe("Raghu (Manufacturer Rep)");
      expect(order.assigned_driver_phone).toBe("+91 98888 11111");

      const audits = await fetchAuditLogs();
      const orderAudit = audits.find(
        (a) => a.record_id === order.id || a.description.includes(order.id),
      );
      expect(orderAudit).toBeDefined();
    });

    it("allows Supervisor to switch an order to Manufacturer Vehicle path", async () => {
      const res = await createOrder({
        companyId: "asian",
        customerName: "Metro Buildtech",
        productName: "Birla Super 53 Grade Cement",
        quantity: 30,
        unitPrice: 380,
        creatorName: "Priya Sharma (Sales)",
      });

      expect(res.success).toBe(true);
      const order = res.order!;

      const updated = await assignOrderVehicle(order.id, {
        transportMode: "Manufacturer Vehicle",
        driverName: "Manufacturer Driver Shyam",
        driverPhone: "+91 98765 00000",
        assignedByName: "Arun Nair",
        assignedByRole: "supervisor",
      });

      expect(updated.transport_mode).toBe("Manufacturer Vehicle");
      expect(updated.assigned_vehicle).toBe("Manufacturer Arranged");
      expect(updated.assigned_driver).toBe("Manufacturer Driver Shyam");

      const audits = await fetchAuditLogs();
      const matched = audits.find(
        (a) =>
          a.record_id === order.id &&
          a.description.includes("Manufacturer Vehicle (Direct Collection)"),
      );
      expect(matched).toBeDefined();
    });
  });

  describe("2. Logistics / Assigned Vehicle Path & Role Assignment", () => {
    it("allows Sales to assign an available company vehicle and driver at order time", async () => {
      const res = await createOrder({
        companyId: "asian",
        customerName: "Sobha Developers",
        productName: "Birla Super 53 Grade Cement",
        quantity: 100,
        unitPrice: 380,
        creatorName: "Priya Sharma (Sales)",
        transportMode: "Logistics / Assigned Vehicle",
        assignedVehicle: testVehicle.plate_number,
        assignedDriver: "Suresh Gowda",
        assignedDriverPhone: "+91 98450 99999",
      });

      expect(res.success).toBe(true);
      const order = res.order!;
      expect(order.transport_mode).toBe("Logistics / Assigned Vehicle");
      expect(order.assigned_vehicle).toBe(testVehicle.plate_number);
      expect(order.assigned_driver).toBe("Suresh Gowda");

      // Verify the vehicle was updated to Assigned / Booked
      const vehicles = await fetchVehicles();
      const updatedVehicle = vehicles.find((v) => v.id === testVehicle.id);
      expect(updatedVehicle?.status).toBe("Assigned / Booked");
    });

    it("allows Supervisor or Super Admin to assign or reassign a vehicle later", async () => {
      const res = await createOrder({
        companyId: "asian",
        customerName: "Prestige Estates",
        productName: "Birla Super 53 Grade Cement",
        quantity: 60,
        unitPrice: 380,
        creatorName: "Priya Sharma (Sales)",
      });

      expect(res.success).toBe(true);
      const order = res.order!;

      // Supervisor assigns vehicle
      const assigned = await assignOrderVehicle(order.id, {
        transportMode: "Logistics / Assigned Vehicle",
        vehicleNumber: testVehicle.plate_number,
        driverName: "Suresh Gowda",
        assignedByName: "Arun Nair",
        assignedByRole: "supervisor",
      });

      expect(assigned.assigned_vehicle).toBe(testVehicle.plate_number);

      // Super Admin reassigns
      const retestVehicle = await createVehicle(
        {
          name: "Eicher Super",
          plateNumber: `KA-01-RE-${Math.floor(1000 + Math.random() * 9000)}`,
          status: "Available / At Godown",
          capacity: "4 Tons",
        },
        "Super Admin",
      );

      const reassigned = await assignOrderVehicle(order.id, {
        transportMode: "Logistics / Assigned Vehicle",
        vehicleNumber: retestVehicle.plate_number,
        driverName: "Kiran Joshi",
        assignedByName: "Harshith (Super Admin)",
        assignedByRole: "super_admin",
      });

      expect(reassigned.assigned_vehicle).toBe(retestVehicle.plate_number);
      expect(reassigned.assigned_driver).toBe("Kiran Joshi");
    });
  });

  describe("3. Vehicle Availability Constraints & Lifecycle", () => {
    it("STRICT: Rejects assigning a vehicle that is currently Dispatched / On Delivery", async () => {
      // Mark vehicle as Dispatched / On Delivery
      await updateVehicleStatus(
        testVehicle.id,
        "Dispatched / On Delivery",
        "Logistics User",
        "Out for transit",
      );

      const res = await createOrder({
        companyId: "asian",
        customerName: "Brigade Enterprises",
        productName: "Birla Super 53 Grade Cement",
        quantity: 40,
        unitPrice: 380,
        creatorName: "Priya Sharma (Sales)",
      });

      expect(res.success).toBe(true);
      const order = res.order!;

      // Attempting to assign this dispatched vehicle must throw an error
      await expect(
        assignOrderVehicle(order.id, {
          transportMode: "Logistics / Assigned Vehicle",
          vehicleNumber: testVehicle.plate_number,
          assignedByName: "Arun Nair",
          assignedByRole: "supervisor",
        }),
      ).rejects.toThrow(
        /currently Dispatched \/ On Delivery and cannot be assigned to another order/i,
      );

      // Attempting to create order directly with dispatched vehicle must also fail gracefully
      const directOrderRes = await createOrder({
        companyId: "asian",
        customerName: "Puravankara Projects",
        productName: "Birla Super 53 Grade Cement",
        quantity: 20,
        unitPrice: 380,
        creatorName: "Priya Sharma (Sales)",
        transportMode: "Logistics / Assigned Vehicle",
        assignedVehicle: testVehicle.plate_number,
      });

      expect(directOrderRes.success).toBe(false);
      expect(directOrderRes.error).toMatch(
        /currently Dispatched \/ On Delivery and cannot be assigned to another order/i,
      );
    });

    it("allows marking vehicle 'Returned to Godown' after delivery, restoring its assignability", async () => {
      // Set status to Dispatched
      await updateVehicleStatus(testVehicle.id, "Dispatched / On Delivery", "Logistics User");

      // Logistics user or Supervisor marks it Returned to Godown
      const returnedVehicle = await updateVehicleStatus(
        testVehicle.id,
        "Returned to Godown",
        "Arun Nair (Supervisor)",
        "Delivery completed, returned to godown",
      );

      expect(returnedVehicle?.status).toBe("Returned to Godown");

      // Now vehicle CAN be assigned to another order
      const res = await createOrder({
        companyId: "asian",
        customerName: "Assetz Property",
        productName: "Birla Super 53 Grade Cement",
        quantity: 50,
        unitPrice: 380,
        creatorName: "Priya Sharma (Sales)",
      });

      expect(res.success).toBe(true);
      const order = res.order!;

      const assigned = await assignOrderVehicle(order.id, {
        transportMode: "Logistics / Assigned Vehicle",
        vehicleNumber: testVehicle.plate_number,
        assignedByName: "Priya Sharma",
        assignedByRole: "sales",
      });

      expect(assigned.assigned_vehicle).toBe(testVehicle.plate_number);
    });
  });

  describe("4. Super Admin Fleet Management (Add, Edit, Delete)", () => {
    it("Super Admin can edit vehicle details and capacity", async () => {
      const updated = await updateVehicle(
        testVehicle.id,
        {
          name: "Ashok Leyland Dost Plus",
          capacity: "2.5 Tons",
          driver_name: "Ganesh Hegde",
          driver_phone: "+91 99000 11222",
        },
        "Harshith (Super Admin)",
      );

      expect(updated.name).toBe("Ashok Leyland Dost Plus");
      expect(updated.capacity).toBe("2.5 Tons");
      expect(updated.driver_name).toBe("Ganesh Hegde");
      expect(updated.driver_phone).toBe("+91 99000 11222");

      const audits = await fetchAuditLogs();
      const editAudit = audits.find(
        (a) => a.action === "vehicle_updated" && a.record_id === testVehicle.id,
      );
      expect(editAudit).toBeDefined();
    });

    it("Super Admin can delete a vehicle from the fleet", async () => {
      const vehicleToDelete = await createVehicle(
        {
          name: "Scrap Truck",
          plateNumber: `KA-02-DEL-${Math.floor(1000 + Math.random() * 9000)}`,
          status: "Available / At Godown",
        },
        "Super Admin",
      );

      const deleted = await deleteVehicle(vehicleToDelete.id, "Harshith (Super Admin)");
      expect(deleted).toBe(true);

      const vehicles = await fetchVehicles();
      const found = vehicles.find((v) => v.id === vehicleToDelete.id);
      expect(found).toBeUndefined();

      const audits = await fetchAuditLogs();
      const deleteAudit = audits.find(
        (a) => a.action === "vehicle_deleted" && a.record_id === vehicleToDelete.id,
      );
      expect(deleteAudit).toBeDefined();
    });
  });
});
