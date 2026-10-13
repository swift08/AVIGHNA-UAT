import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  CreditCard,
  ExternalLink,
  FileCheck2,
  Filter,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Mic,
  MicOff,
  Navigation,
  Package,
  Pause,
  Phone,
  Play,
  Plus,
  Search,
  ShieldAlert,
  ShoppingBag,
  Target,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  Volume2,
  X,
  ImageIcon,
  Trash2,
  Pencil,
  Copy,
  Columns3,
  List,
  ShieldCheck,
  FileText,
  History,
  IndianRupee,
  Clock,
  BarChart3,
  Download,
  Eye,
  Scale,
  AlertTriangle,
} from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useWorkspace } from "./workspace-provider";
import { CompanyLogo } from "./workspace-shell";
import { OrderTable } from "./order-workspace";
import { TaskWorkspace } from "./task-workspace";
import { RevenueChart } from "./revenue-chart";
import {
  CompanyRevenuePieChart,
  OrderStatusPieChart,
  CompanyComparisonBarChart,
  ConversionFunnelBarChart,
  ProductCategoryCharts,
} from "./analytics-charts";
import { companies, money } from "@/lib/workspace-data";
import { SYSTEM_USERS } from "@/lib/auth-service";
import { scopeForDriver } from "@/lib/driver-scope";
import { listStaffLogins } from "@/lib/login-admin";
import { TeamLogins } from "./team-logins";
import {
  fetchOrders,
  createOrder,
  fetchProducts,
  fetchLeads,
  createLead,
  updateLead,
  canEditLead,
  updateLeadStage,
  convertLeadToCustomer,
  fetchFieldVisits,
  scheduleFieldVisit,
  completeFieldVisit,
  fetchPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  receivePurchaseGoods,
  updateFieldVisit,
  fetchInvoices,
  generateInvoice,
  fetchPayments,
  fetchCustomers,
  createCustomer,
  updateCustomer,
  createProduct,
  inboundStock,
  updateProductStock,
  recordPayment,
  fetchDeliveries,
  dispatchDelivery,
  completeDelivery,
  deliveryProofReady,
  deleteFieldVisit,
  deleteCustomer,
  deleteLead,
  deleteOrder,
  deleteProduct,
  deletePurchaseOrder,
  deleteInvoice,
  deleteDelivery,
  deleteTask,
  fetchCreditNotes,
  createCreditNote,
  deleteCreditNote,
  updateCustomerCreditLimit,
  fetchVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  updateVehicleStatus,
  outboundOrderedQuantity,
  availableFromStock,
  type DBOrder,
  type DBProduct,
  type DBLead,
  type DBFieldVisit,
  type DBPurchaseOrder,
  type DBInvoice,
  type DBCustomer,
  type DBDelivery,
  type DBPayment,
  type DBCreditNote,
  type DBVehicle,
  type VehicleStatus,
} from "@/lib/erp-service";

const FALLBACK_PROOF_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="#f8fafc"/>
  <rect x="16" y="16" width="368" height="268" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" stroke-dasharray="6,6"/>
  <circle cx="200" cy="120" r="32" fill="#f1f5f9"/>
  <path d="M188 120a12 12 0 1 0 24 0a12 12 0 1 0 -24 0" fill="#94a3b8"/>
  <path d="M180 135h40l-6-10h-28z" fill="#94a3b8"/>
  <text x="200" y="180" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#334155" text-anchor="middle">Field Proof Photo</text>
  <text x="200" y="202" font-family="system-ui, sans-serif" font-size="11" fill="#64748b" text-anchor="middle">Captured On-site</text>
</svg>
`);

export const PRESET_UNITS = [
  { value: "kg", label: "kg (Kilograms)" },
  { value: "L", label: "L (Liters)" },
  { value: "g", label: "g (Grams)" },
  { value: "ml", label: "ml (Milliliters)" },
  { value: "bags", label: "bags (Bags / Sacks)" },
  { value: "boxes", label: "boxes (Boxes / Cartons)" },
  { value: "cartons", label: "cartons (Cartons)" },
  { value: "pcs", label: "pcs (Pieces)" },
  { value: "units", label: "units (Units)" },
  { value: "drums", label: "drums (Drums / Barrels)" },
  { value: "cans", label: "cans (Cans / Tins)" },
  { value: "tons", label: "tons (Metric Tons)" },
];

async function processImageFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxDim = 1000;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.75));
        } else {
          resolve((e.target?.result as string) || "");
        }
      };
      img.onerror = () => resolve((e.target?.result as string) || "");
      img.src = (e.target?.result as string) || "";
    };
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

export function ModuleWorkspace({ module }: { module: string }) {
  const navigate = useNavigate();
  const routerSearch = useRouterState({
    select: (s) => (s.location.search as Record<string, string>) || {},
  });
  const { company, currentUser, hasPermission } = useWorkspace();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [tab, setTab] = useState("Overview");

  const isSuperAdmin = currentUser?.role === "super_admin" || hasPermission("*");
  const isSupervisor =
    currentUser?.role === "supervisor" ||
    Boolean(currentUser?.roleName?.toLowerCase().includes("supervisor"));
  const canViewAllFieldVisits = isSuperAdmin || isSupervisor;

  const [deleteTarget, setDeleteTarget] = useState<{
    type: string;
    id: string;
    name: string;
    onDelete: () => Promise<void>;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const navigateToCreateOrder = (params: {
    customerName: string;
    companyId?: string;
    notes?: string;
  }) => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(
          "prefill_customer_order",
          JSON.stringify({
            customer: params.customerName,
            company: params.companyId || "asian",
            notes: params.notes || "",
          }),
        );
      } catch {
        // Ignore session storage errors
      }
    }

    try {
      navigate({
        to: "/orders",
        search: {
          customer: params.customerName,
          company: params.companyId || "asian",
          notes: params.notes || "",
          openCreate: "true",
        } as unknown as Record<string, string>,
      });
    } catch {
      window.location.assign(
        `/orders?customer=${encodeURIComponent(params.customerName)}&company=${encodeURIComponent(params.companyId || "asian")}&openCreate=true`,
      );
    }
  };

  // Live state from Supabase
  const [dbOrders, setDbOrders] = useState<DBOrder[]>([]);
  const [dbProducts, setDbProducts] = useState<DBProduct[]>([]);
  const [dbLeads, setDbLeads] = useState<DBLead[]>([]);
  const [dbVisits, setDbVisits] = useState<DBFieldVisit[]>([]);
  const [dbPOs, setDbPOs] = useState<DBPurchaseOrder[]>([]);
  const [dbInvoices, setDbInvoices] = useState<DBInvoice[]>([]);
  const [dbCustomers, setDbCustomers] = useState<DBCustomer[]>([]);
  const [dbDeliveries, setDbDeliveries] = useState<DBDelivery[]>([]);
  const [dbPayments, setDbPayments] = useState<DBPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const visibleFieldVisits = useMemo(() => {
    if (canViewAllFieldVisits) {
      return dbVisits;
    }
    const currentUserName = currentUser?.name?.trim().toLowerCase() || "";
    const currentUserId = currentUser?.id;
    return dbVisits.filter((v) => {
      if (currentUserId && v.assigned_to && v.assigned_to === currentUserId) return true;
      if (v.assigned_to_name && v.assigned_to_name.trim().toLowerCase() === currentUserName)
        return true;
      if (v.creator_name && v.creator_name.trim().toLowerCase() === currentUserName) return true;
      return false;
    });
  }, [dbVisits, canViewAllFieldVisits, currentUser]);

  // Lead modal state (All 11 user fields)
  const [leadModal, setLeadModal] = useState(false);
  const [leadCompany, setLeadCompany] = useState("asian");
  const [leadName, setLeadName] = useState("");
  const [leadContact, setLeadContact] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadGstin, setLeadGstin] = useState("");
  const [leadCity, setLeadCity] = useState("");
  const [leadProductInterest, setLeadProductInterest] = useState("");
  const [leadEstimatedValue, setLeadEstimatedValue] = useState("");
  const [leadSource, setLeadSource] = useState("WhatsApp");
  const [leadReferrer, setLeadReferrer] = useState("");
  const [leadType, setLeadType] = useState("Wholesale");
  const [leadPriority, setLeadPriority] = useState("Medium");
  const [leadNotes, setLeadNotes] = useState("");
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);

  // Leads Workspace search & filter state
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [leadPriorityFilter, setLeadPriorityFilter] = useState("All");
  const [leadMobileStageFilter, setLeadMobileStageFilter] = useState("All");
  const [selectedLeadDetails, setSelectedLeadDetails] = useState<DBLead | null>(null);

  // Customer modal state (All 11 user fields)
  const [custModal, setCustModal] = useState(false);
  const [custCompany, setCustCompany] = useState("asian");
  const [custLegalName, setCustLegalName] = useState("");
  const [custTradeName, setCustTradeName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custGstin, setCustGstin] = useState("");
  const [custBillingAddress, setCustBillingAddress] = useState("");
  const [custShippingAddress, setCustShippingAddress] = useState("");
  const [custType, setCustType] = useState("Wholesale");
  const [custContact, setCustContact] = useState("");
  const [custCreditLimit, setCustCreditLimit] = useState("0");
  const [custCreditDays, setCustCreditDays] = useState("30");
  const [selectedCustomerDetails, setSelectedCustomerDetails] = useState<DBCustomer | null>(null);

  // Edit customer modal state
  const [editCustModal, setEditCustModal] = useState(false);
  const [editCustId, setEditCustId] = useState("");
  const [editCustName, setEditCustName] = useState("");
  const [editCustContact, setEditCustContact] = useState("");
  const [editCustPhone, setEditCustPhone] = useState("");
  const [editCustEmail, setEditCustEmail] = useState("");
  const [editCustAddress, setEditCustAddress] = useState("");
  const [editCustNotes, setEditCustNotes] = useState("");
  const [editCustStatus, setEditCustStatus] = useState<"Active" | "Inactive">("Active");
  const [editCustCreditDays, setEditCustCreditDays] = useState("30");
  const [editCustCompany, setEditCustCompany] = useState("asian");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Product modal state
  const [prodModal, setProdModal] = useState(false);
  const [prodCode, setProdCode] = useState("");
  const [prodName, setProdName] = useState("");
  const [prodCategory, setProdCategory] = useState("Dairy");
  const [prodUnit, setProdUnit] = useState("kg");
  const [isCustomProdUnit, setIsCustomProdUnit] = useState(false);
  const [customProdUnit, setCustomProdUnit] = useState("");
  const [prodPrice, setProdPrice] = useState("350"); // Selling Price
  const [prodWholesalePrice, setProdWholesalePrice] = useState("300"); // Wholesale Price
  const [prodOnHand, setProdOnHand] = useState("100");
  const [prodReorder, setProdReorder] = useState("20");
  const [prodCompany, setProdCompany] = useState("asian");

  // Inbound stock modal state
  const [inboundModal, setInboundModal] = useState(false);
  const [inboundProductId, setInboundProductId] = useState("");
  const [inboundQty, setInboundQty] = useState("50");
  const [inboundReorder, setInboundReorder] = useState("20");
  const [inboundNotes, setInboundNotes] = useState("");

  // Edit existing stock modal state
  const [editStockModal, setEditStockModal] = useState(false);
  const [editStockProduct, setEditStockProduct] = useState<DBProduct | null>(null);
  const [editStockOnHand, setEditStockOnHand] = useState("");
  const [editStockReorder, setEditStockReorder] = useState("");
  const [editStockUnitPrice, setEditStockUnitPrice] = useState(""); // Selling Price
  const [editStockWholesalePrice, setEditStockWholesalePrice] = useState(""); // Wholesale Price
  const [editStockUnit, setEditStockUnit] = useState("kg");
  const [isCustomEditStockUnit, setIsCustomEditStockUnit] = useState(false);
  const [customEditStockUnit, setCustomEditStockUnit] = useState("");
  const [editStockReason, setEditStockReason] = useState("Physical inventory recount / audit");
  const [editStockNotes, setEditStockNotes] = useState("");

  // Purchase Order modal state
  const [poModal, setPoModal] = useState(false);
  const [poSupplier, setPoSupplier] = useState("");
  const [poProduct, setPoProduct] = useState("");
  const [poQuantity, setPoQuantity] = useState("100");
  const [poUnit, setPoUnit] = useState("kg");
  const [isCustomPoUnit, setIsCustomPoUnit] = useState(false);
  const [customPoUnit, setCustomPoUnit] = useState("");
  const [poPrice, setPoPrice] = useState("250");
  const [poCompany, setPoCompany] = useState("asian");

  // Purchase Order Edit modal state (Super Admin and Supervisor)
  const [editPoModal, setEditPoModal] = useState(false);
  const [editingPo, setEditingPo] = useState<DBPurchaseOrder | null>(null);
  const [editPoSupplier, setEditPoSupplier] = useState("");
  const [editPoProduct, setEditPoProduct] = useState("");
  const [editPoQuantity, setEditPoQuantity] = useState("100");
  const [editPoUnit, setEditPoUnit] = useState("kg");
  const [isCustomEditPoUnit, setIsCustomEditPoUnit] = useState(false);
  const [customEditPoUnit, setCustomEditPoUnit] = useState("");
  const [editPoPrice, setEditPoPrice] = useState("250");
  const [editPoCompany, setEditPoCompany] = useState("asian");
  const [editPoStatus, setEditPoStatus] = useState<DBPurchaseOrder["status"]>("Requested");

  // Field visit & "Log a visit" state
  const [visitFirm, setVisitFirm] = useState<string>("asian");
  const [visitSelectedCustomer, setVisitSelectedCustomer] = useState("");
  const [visitPurpose, setVisitPurpose] = useState("Follow-up");
  const [visitCustomPurpose, setVisitCustomPurpose] = useState("");
  const [visitRequirement, setVisitRequirement] = useState("");
  const [visitLogDate, setVisitLogDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [visitLogTime, setVisitLogTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  );

  // Field visit Edit modal state (1-time edit for sales, full edit for superadmin/supervisor)
  const [editVisitModal, setEditVisitModal] = useState(false);
  const [editingVisit, setEditingVisit] = useState<DBFieldVisit | null>(null);
  const [editVisitDate, setEditVisitDate] = useState("");
  const [editVisitTime, setEditVisitTime] = useState("");
  const [editVisitPurpose, setEditVisitPurpose] = useState("");
  const [editVisitNotes, setEditVisitNotes] = useState("");

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasVoiceNote, setHasVoiceNote] = useState(false);
  const [voiceAudioDataUrl, setVoiceAudioDataUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [audioTotalDuration, setAudioTotalDuration] = useState(8);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const speechIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartTimeRef = useRef<number>(0);
  const [gpsLocation, setGpsLocation] = useState<{ lat: number; lng: number; time: string } | null>(
    null,
  );
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const [visitSuccessNotice, setVisitSuccessNotice] = useState<string | null>(null);
  const [visitModal, setVisitModal] = useState(false);
  const [visitCustomer, setVisitCustomer] = useState("");
  const [visitDate, setVisitDate] = useState("2026-10-07");
  const [visitTime, setVisitTime] = useState("10:00 AM");

  // Media Inspection & Audio Player State
  const [selectedVisitAudio, setSelectedVisitAudio] = useState<DBFieldVisit | null>(null);
  const [selectedVisitPhoto, setSelectedVisitPhoto] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioTimer, setAudioTimer] = useState(0);
  const [visitSalesFilter, setVisitSalesFilter] = useState("All");

  // Dispatch modal state
  const [dispatchModal, setDispatchModal] = useState(false);
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<DBOrder | null>(null);
  const [dispatchDate, setDispatchDate] = useState(
    () => new Date().toISOString().split("T")[0] || "",
  );
  const [dispatchTimeWindow, setDispatchTimeWindow] = useState("Morning (09:00 - 13:00)");
  const [vehicleNo, setVehicleNo] = useState("KA 01 AB 1024");
  const [driverName, setDriverName] = useState("Mahesh Patel");
  const [driverChoices, setDriverChoices] = useState<{ name: string; phone: string }[]>(
    SYSTEM_USERS.filter((user) => user.role === "logistics").map((user) => ({
      name: user.name,
      phone: user.phone,
    })),
  );
  const [driverPhone, setDriverPhone] = useState("+91 98450 33445");

  // Invoice viewer modal state
  const [invoiceViewModal, setInvoiceViewModal] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<DBInvoice | null>(null);
  const [viewingOrder, setViewingOrder] = useState<DBOrder | null>(null);

  // Logistics POD modal state
  const [podModal, setPodModal] = useState(false);
  const [selectedDeliveryForPod, setSelectedDeliveryForPod] = useState<DBDelivery | null>(null);
  const [podOutcome, setPodOutcome] = useState<"Delivered" | "Partially Delivered" | "Failed">(
    "Delivered",
  );
  const [podDeliveredQty, setPodDeliveredQty] = useState("1");
  const [podRemainingQty, setPodRemainingQty] = useState("0");
  const [podReceiverName, setPodReceiverName] = useState("");
  const [podReceiverPhone, setPodReceiverPhone] = useState("");
  const [podFailureReason, setPodFailureReason] = useState("Customer unavailable / door locked");
  const [podReturnNotes, setPodReturnNotes] = useState("");
  const [podPhotoPreview, setPodPhotoPreview] = useState<string | null>(null);
  const [podPhotoUrls, setPodPhotoUrls] = useState<string[]>([]);
  const [podGps, setPodGps] = useState<{ lat: number; lng: number; time: string } | null>(null);
  const [podGpsError, setPodGpsError] = useState("");
  const [podPhotoError, setPodPhotoError] = useState("");
  const [podRemarks, setPodRemarks] = useState("");
  const [logisticsActiveTab, setLogisticsActiveTab] = useState<"trips" | "order_desk">("trips");

  // Payment modal state
  const [paymentModal, setPaymentModal] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<DBInvoice | null>(
    null,
  );
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"Bank Transfer" | "Cheque" | "Cash" | "UPI">(
    "Bank Transfer",
  );
  const [payRef, setPayRef] = useState("TXN-98231");

  // Fleet management state
  const [dbVehicles, setDbVehicles] = useState<DBVehicle[]>([]);
  const [vehicleModal, setVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<DBVehicle | null>(null);
  const [truckName, setTruckName] = useState("");
  const [truckPlate, setTruckPlate] = useState("");
  const [truckDriverName, setTruckDriverName] = useState("");
  const [truckDriverPhone, setTruckDriverPhone] = useState("");
  const [truckCapacity, setTruckCapacity] = useState("2.5 Tons");
  const [truckCompanyId, setTruckCompanyId] = useState("all");
  const [truckStatus, setTruckStatus] = useState<VehicleStatus>("Available / At Godown");
  const [vehicleSaving, setVehicleSaving] = useState(false);

  // Credit control state
  const [dbCreditNotes, setDbCreditNotes] = useState<DBCreditNote[]>([]);
  const [creditSearch, setCreditSearch] = useState("");
  const [creditStatusFilter, setCreditStatusFilter] = useState("all");
  const [creditBalanceFilter, setCreditBalanceFilter] = useState("all");

  // Post credit note form state
  const [noteInvoiceId, setNoteInvoiceId] = useState("");
  const [noteType, setNoteType] = useState<"Credit note" | "Debit note">("Credit note");
  const [noteReason, setNoteReason] = useState("Returned goods");
  const [noteAmount, setNoteAmount] = useState("");
  const [postingNote, setPostingNote] = useState(false);

  // Edit credit limit drawer state
  const [editCreditModal, setEditCreditModal] = useState(false);
  const [selectedCreditCustomer, setSelectedCreditCustomer] = useState<DBCustomer | null>(null);
  const [editCreditLimit, setEditCreditLimit] = useState("");
  const [editCreditDays, setEditCreditDays] = useState("");
  const [savingCreditLimit, setSavingCreditLimit] = useState(false);

  // Invoices & accounts desk states
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("All statuses");
  const [invoiceDateFilter, setInvoiceDateFilter] = useState("All dates");
  const [invoiceOverdueOnly, setInvoiceOverdueOnly] = useState(false);

  // Ready to invoice states
  const [readyToInvoiceSearch, setReadyToInvoiceSearch] = useState("");
  const [readyToInvoiceCreditFilter, setReadyToInvoiceCreditFilter] = useState("All credit");
  const [raiseInvoiceModal, setRaiseInvoiceModal] = useState(false);
  const [selectedOrderForInvoice, setSelectedOrderForInvoice] = useState<DBOrder | null>(null);
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState("");
  const [customDueDate, setCustomDueDate] = useState("");
  const [customBillNotes, setCustomBillNotes] = useState("");
  const [raisingInvoice, setRaisingInvoice] = useState(false);

  const reloadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchOrders(company),
      fetchProducts(company),
      fetchLeads(company),
      fetchFieldVisits(company),
      fetchPurchaseOrders(company),
      fetchInvoices(company),
      fetchPayments(company),
      fetchCustomers(company),
      fetchDeliveries(company),
      fetchCreditNotes(company),
      fetchVehicles(),
    ])
      .then(
        ([
          orders,
          products,
          leads,
          visits,
          purchaseOrders,
          invoices,
          payments,
          customers,
          deliveries,
          creditNotes,
          vehicles,
        ]) => {
          const scoped = scopeForDriver(currentUser, {
            orders,
            products,
            leads,
            visits,
            purchaseOrders,
            invoices,
            payments,
            customers,
            deliveries,
            creditNotes,
            vehicles,
          });
          setDbOrders(scoped.orders ?? []);
          setDbProducts(scoped.products ?? []);
          setDbLeads(scoped.leads ?? []);
          setDbVisits(scoped.visits ?? []);
          setDbPOs(scoped.purchaseOrders ?? []);
          setDbInvoices(scoped.invoices ?? []);
          setDbPayments(scoped.payments ?? []);
          setDbCustomers(scoped.customers ?? []);
          setDbDeliveries(scoped.deliveries ?? []);
          setDbCreditNotes(scoped.creditNotes ?? []);
          setDbVehicles(scoped.vehicles ?? []);
        },
      )
      .finally(() => setLoading(false));
  }, [company, currentUser]);

  useEffect(() => {
    reloadData();
  }, [reloadData, module]);

  useEffect(() => {
    if (currentUser?.role !== "super_admin" && currentUser?.role !== "supervisor") return;
    listStaffLogins()
      .then((res) => {
        if (!res.ok) return;
        const extras = res.users
          .filter((user) => user.role === "logistics")
          .map((user) => ({ name: user.name, phone: user.phone }));
        setDriverChoices((current) => {
          const names = new Set(current.map((item) => item.name));
          return [...current, ...extras.filter((item) => !names.has(item.name))];
        });
      })
      .catch(() => {});
  }, [currentUser?.role]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const rows = dbOrders.filter((o) => {
    const matchesSearch = `${o.customer_name} ${o.id}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "All statuses" || o.status === status;
    return matchesSearch && matchesStatus;
  });

  const titles: Record<string, string> = {
    orders: "Orders",
    tasks: "My work",
    leads: "Lead pipeline",
    customers: "Customers",
    inventory: "Inventory intelligence",
    purchases: "Purchases",
    logistics: "Dispatch control",
    accounts: "Invoices",
    credit: "Credit control",
    analytics: "Revenue intelligence",
    administration: "Administration",
    "field-visits": "Field visits",
  };

  const subtitle: Record<string, string> = {
    orders: "Every order. Every milestone. One clear view.",
    tasks: "The right work, in the right hands.",
    leads: "Turn meaningful conversations into lasting relationships.",
    customers: "Your relationships, at a glance.",
    inventory: "Know what’s on hand. Stay ahead of what’s next.",
    purchases: "From supplier to stock, without the guesswork.",
    logistics: "Keep your deliveries moving.",
    accounts:
      "Ready to invoice shows orders after Supervisor confirmed/added the vehicle. Enter bill details, then raise the invoice. After that book the driver on Order desk.",
    credit:
      "Limits, days and credit/debit notes. Accounts adjusts receivables — warehouse handles stock.",
    analytics: "The numbers behind your next decision.",
    administration: "Your organization, thoughtfully managed.",
    "field-visits": "Closer to your customers.",
  };

  // Voice recording timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const resetLeadForm = () => {
    setEditingLeadId(null);
    setLeadName("");
    setLeadContact("");
    setLeadPhone("");
    setLeadEmail("");
    setLeadGstin("");
    setLeadCity("");
    setLeadProductInterest("");
    setLeadEstimatedValue("");
    setLeadSource("WhatsApp");
    setLeadReferrer("");
    setLeadType("Wholesale");
    setLeadPriority("Medium");
    setLeadNotes("");
  };

  const openEditLead = (lead: DBLead) => {
    if (!lead.id) return;
    const typePart = (lead.requirement || "").split(" · ").find((part) => part.startsWith("Type:"));
    const gstPart = (lead.requirement || "").split(" · ").find((part) => part.startsWith("GSTIN:"));
    setEditingLeadId(lead.id);
    setLeadCompany(lead.company_id || "asian");
    setLeadName(lead.business_name);
    setLeadContact(lead.contact_person);
    setLeadPhone(lead.phone || "");
    setLeadEmail(lead.email || "");
    setLeadGstin(lead.gstin || (gstPart ? gstPart.slice(6).trim() : ""));
    setLeadCity(lead.city || "");
    setLeadProductInterest(lead.product_interest || "");
    setLeadEstimatedValue(lead.estimated_value ? String(lead.estimated_value) : "");
    setLeadSource(lead.source || "WhatsApp");
    setLeadReferrer(lead.referred_by || "");
    setLeadType(typePart ? typePart.slice(5).trim() : "Wholesale");
    setLeadPriority(lead.priority || "Medium");
    setLeadNotes(lead.notes || "");
    setSelectedLeadDetails(null);
    setLeadModal(true);
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeCompany =
      leadCompany === "all" ? (company !== "all" ? company : "asian") : leadCompany;
    const payload = {
      companyId: safeCompany || "asian",
      businessName: leadName,
      contactPerson: leadContact,
      phone: leadPhone,
      email: leadEmail,
      gstin: leadGstin,
      city: leadCity,
      productInterest: leadProductInterest,
      estimatedValue: parseFloat(leadEstimatedValue) || undefined,
      source: leadSource,
      leadType: leadType,
      priority: leadPriority,
      notes: leadNotes,
      referredBy: leadSource === "Referral" ? leadReferrer.trim() : undefined,
    };
    try {
      if (editingLeadId) {
        await updateLead(editingLeadId, payload, {
          role: currentUser?.role || "",
          name: currentUser?.name || "User",
        });
      } else {
        await createLead({ ...payload, creatorName: currentUser?.name || "Ravi Kumar" });
      }
      setLeadModal(false);
      resetLeadForm();
      reloadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not save lead.");
    }
  };

  const handleConvertLead = async (lead: DBLead) => {
    if (!lead.id) return;
    try {
      const targetCompany =
        lead.company_id && lead.company_id !== "all"
          ? lead.company_id
          : company !== "all"
            ? company
            : "asian";

      const cust = await convertLeadToCustomer(
        lead.id,
        targetCompany,
        lead.business_name || "New Customer",
        lead.contact_person || "Key Contact",
        currentUser?.name || "Ravi Kumar",
        {
          phone: lead.phone || undefined,
          email: lead.email || undefined,
          address: lead.city || undefined,
          notes: [
            lead.notes,
            lead.requirement ? `Requirement: ${lead.requirement}` : "",
            lead.source ? `Source: ${lead.source}` : "",
            lead.expected_quantity ? `Expected: ${lead.expected_quantity}` : "",
            lead.gstin ? `GSTIN: ${lead.gstin}` : "",
          ]
            .filter(Boolean)
            .join(" · "),
        },
      );

      // Immediately add / update in local state so customer displays on Customers page instantly
      setDbCustomers((prev) => {
        const filtered = prev.filter(
          (c) => c.id !== cust.id && c.name.toLowerCase() !== cust.name.toLowerCase(),
        );
        return [cust, ...filtered];
      });

      // Update lead stage in state
      setDbLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id ? { ...l, stage: "Converted", converted_customer_id: cust.id } : l,
        ),
      );

      if (selectedLeadDetails && selectedLeadDetails.id === lead.id) {
        setSelectedLeadDetails((prev) =>
          prev ? { ...prev, stage: "Converted", converted_customer_id: cust.id } : null,
        );
      }

      reloadData();
    } catch (err) {
      console.error("Failed to convert lead:", err);
      alert(`Could not convert lead: ${err instanceof Error ? err.message : "Database error"}`);
    }
  };

  const handleUpdateLeadStage = async (
    leadId: string,
    newStage: "New" | "Qualified" | "Follow-up" | "Converted",
  ) => {
    try {
      if (newStage === "Converted") {
        const targetLead =
          dbLeads.find((l) => l.id === leadId) ||
          (selectedLeadDetails?.id === leadId ? selectedLeadDetails : null);
        if (targetLead) {
          await handleConvertLead(targetLead);
          return;
        }
      }
      await updateLeadStage(leadId, newStage, currentUser?.name || "Sales Executive");
      setDbLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l)));
      if (selectedLeadDetails && selectedLeadDetails.id === leadId) {
        setSelectedLeadDetails((prev) => (prev ? { ...prev, stage: newStage } : null));
      }
      reloadData();
    } catch (err) {
      console.error("Failed to update lead stage:", err);
    }
  };

  const openEditCustomer = (c: DBCustomer) => {
    const matchingLead = dbLeads.find(
      (l) =>
        l.converted_customer_id === c.id ||
        (l.business_name && l.business_name.toLowerCase() === c.name.toLowerCase()) ||
        (l.contact_person &&
          c.contact_person &&
          l.contact_person.toLowerCase() === c.contact_person.toLowerCase()),
    );

    setEditCustId(c.id || "");
    setEditCustName(c.name);
    setEditCustContact(c.contact_person || matchingLead?.contact_person || "");
    setEditCustPhone(c.phone || matchingLead?.phone || "");
    setEditCustEmail(c.email || matchingLead?.email || "");
    setEditCustAddress(c.address || matchingLead?.city || "");
    setEditCustNotes(c.notes || matchingLead?.requirement || "");
    setEditCustStatus(c.status || "Active");
    setEditCustCreditDays(String(c.credit_days || 30));
    setEditCustCompany(c.company_id || "asian");
    setEditCustModal(true);
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCustId) return;
    try {
      const updated = await updateCustomer({
        id: editCustId,
        name: editCustName,
        contactPerson: editCustContact,
        phone: editCustPhone,
        email: editCustEmail,
        address: editCustAddress,
        notes: editCustNotes,
        status: editCustStatus,
        creditDays: parseInt(editCustCreditDays, 10) || 30,
        companyId: editCustCompany,
        userName: currentUser?.name || "Supervisor",
      });

      setDbCustomers((prev) => prev.map((c) => (c.id === editCustId ? updated : c)));
      if (selectedCustomerDetails && selectedCustomerDetails.id === editCustId) {
        setSelectedCustomerDetails(updated);
      }
      setEditCustModal(false);
      reloadData();
    } catch (err: unknown) {
      alert(`Failed to update customer: ${err instanceof Error ? err.message : "Error"}`);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    await createCustomer({
      companyId: custCompany || "asian",
      name: custLegalName,
      tradeName: custTradeName,
      phone: custPhone,
      email: custEmail,
      gstin: custGstin,
      billingAddress: custBillingAddress,
      shippingAddress: custShippingAddress,
      customerType: custType,
      contactPerson: custContact,
      creditLimit: parseFloat(custCreditLimit) || 0,
      creditDays: parseInt(custCreditDays) || 30,
      creatorName: "Ravi Kumar",
    });
    setCustModal(false);
    setCustLegalName("");
    setCustTradeName("");
    setCustPhone("");
    setCustEmail("");
    setCustGstin("");
    setCustBillingAddress("");
    setCustShippingAddress("");
    setCustType("Wholesale");
    setCustContact("");
    setCustCreditLimit("0");
    setCustCreditDays("30");
    reloadData();
  };

  const handleAddGpsAndPhotos = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLocation({
            lat: Number(pos.coords.latitude.toFixed(4)),
            lng: Number(pos.coords.longitude.toFixed(4)),
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });
        },
        () => {
          setGpsLocation({
            lat: 12.9716,
            lng: 77.5946,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          });
        },
      );
    } else {
      setGpsLocation({
        lat: 12.9716,
        lng: 77.5946,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    }

    const input = document.getElementById("proof-photos-input") as HTMLInputElement;
    if (input) input.click();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const processed: string[] = [];
    for (const file of Array.from(files)) {
      const dataUrl = await processImageFile(file);
      if (dataUrl) processed.push(dataUrl);
    }
    setProofPhotos((prev) => [...prev, ...processed]);
    e.target.value = "";
  };

  const startVoiceRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert("Audio recording is not supported on this browser.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, { type });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          setVoiceAudioDataUrl(base64Audio);
          setHasVoiceNote(true);
        };
        reader.readAsDataURL(audioBlob);

        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
        }
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);
      setHasVoiceNote(false);
      setVoiceAudioDataUrl(null);

      // Start live 1-second interval to accurately count recording duration
      recordStartTimeRef.current = Date.now();
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = setInterval(() => {
        const elapsed = Math.max(1, Math.round((Date.now() - recordStartTimeRef.current) / 1000));
        setRecordingDuration(elapsed);
      }, 1000);
    } catch (err: unknown) {
      console.error("Microphone error:", err);
      alert(
        `Could not access microphone: ${err instanceof Error ? err.message : "Permission denied"}. Please allow microphone permissions in your browser.`,
      );
      setIsRecording(false);
    }
  };

  const stopVoiceRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const finalDuration = Math.max(
      1,
      Math.round((Date.now() - (recordStartTimeRef.current || Date.now())) / 1000),
    );
    setRecordingDuration(finalDuration);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    setIsRecording(false);
  };

  const stopCurrentAudio = () => {
    if (speechIntervalRef.current) {
      clearInterval(speechIntervalRef.current);
      speechIntervalRef.current = null;
    }
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
    setIsPlayingPreview(false);
    setAudioTimer(0);
  };

  const playRecordedAudioUrl = (
    audioUrl: string,
    expectedDuration?: number,
    onEnd?: () => void,
  ) => {
    stopCurrentAudio();
    const audio = new Audio(audioUrl);
    audioPlayerRef.current = audio;

    if (expectedDuration && expectedDuration > 0) {
      setAudioTotalDuration(expectedDuration);
    }

    audio.onloadedmetadata = () => {
      if (!isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
        setAudioTotalDuration(Math.round(audio.duration));
      } else if (expectedDuration && expectedDuration > 0) {
        setAudioTotalDuration(expectedDuration);
      }
    };

    audio.ondurationchange = () => {
      if (!isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
        setAudioTotalDuration(Math.round(audio.duration));
      }
    };

    audio.ontimeupdate = () => {
      const cur = Math.round(audio.currentTime);
      setAudioTimer(cur);
      if (cur > audioTotalDuration) {
        setAudioTotalDuration(cur);
      }
    };

    audio.onended = () => {
      setIsPlayingAudio(false);
      setIsPlayingPreview(false);
      setAudioTimer(0);
      if (onEnd) onEnd();
    };

    audio
      .play()
      .then(() => {
        setIsPlayingAudio(true);
      })
      .catch(() => {
        setIsPlayingAudio(false);
        setIsPlayingPreview(false);
      });
  };

  const playAudioMemo = (v: DBFieldVisit) => {
    if (isPlayingAudio && selectedVisitAudio?.id === v.id) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();
    setSelectedVisitAudio(v);

    // Extract duration from filename e.g. "voice-memo-12s.m4a" or "12s"
    const match =
      v.voice_recording_path?.match(/voice-memo-(\d+)s/i) ||
      v.voice_recording_path?.match(/(\d+)s/i);
    const parsedDuration = match && match[1] ? parseInt(match[1], 10) : undefined;
    if (parsedDuration && parsedDuration > 0) {
      setAudioTotalDuration(parsedDuration);
    } else {
      setAudioTotalDuration(8);
    }

    const path = v.voice_recording_path;
    if (
      path &&
      (path.startsWith("data:audio") || path.startsWith("http") || path.startsWith("blob:"))
    ) {
      playRecordedAudioUrl(path, parsedDuration);
    } else {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const text = v.outcome_notes
          ? `Field briefing for ${v.customer_name}. Purpose: ${v.purpose}. Findings: ${v.outcome_notes}`
          : `Field visit memo for ${v.customer_name}. Completed by ${v.assigned_to_name}.`;
        const utterance = new SpeechSynthesisUtterance(text);
        const estDuration = Math.max(5, Math.round(text.length / 13));
        const effectiveDuration = parsedDuration || estDuration;
        setAudioTotalDuration(effectiveDuration);
        setAudioTimer(0);

        utterance.onstart = () => {
          setIsPlayingAudio(true);
          setAudioTimer(0);
          if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
          speechIntervalRef.current = setInterval(() => {
            setAudioTimer((prev) => {
              const next = prev + 1;
              if (next >= effectiveDuration) {
                if (speechIntervalRef.current) clearInterval(speechIntervalRef.current);
                return effectiveDuration;
              }
              return next;
            });
          }, 1000);
        };
        utterance.onend = () => {
          if (speechIntervalRef.current) {
            clearInterval(speechIntervalRef.current);
            speechIntervalRef.current = null;
          }
          setIsPlayingAudio(false);
          setAudioTimer(0);
        };
        utterance.onerror = () => {
          if (speechIntervalRef.current) {
            clearInterval(speechIntervalRef.current);
            speechIntervalRef.current = null;
          }
          setIsPlayingAudio(false);
        };
        window.speechSynthesis.speak(utterance);
      }
    }
  };

  const handleInboundStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inboundProductId) {
      alert("Please select a product");
      return;
    }
    const qty = parseFloat(inboundQty);
    if (isNaN(qty) || qty <= 0) {
      alert("Please enter a valid quantity");
      return;
    }
    const reorder = parseFloat(inboundReorder);
    await inboundStock({
      productId: inboundProductId,
      additionalQuantity: qty,
      newReorderLevel: isNaN(reorder) ? undefined : reorder,
      notes: inboundNotes,
      userName: currentUser?.name || "Warehouse Supervisor",
    });
    setInboundModal(false);
    setInboundNotes("");
    reloadData();
  };

  const openEditStock = (product: DBProduct) => {
    setEditStockProduct(product);
    setEditStockOnHand(String(product.on_hand ?? 0));
    setEditStockReorder(String(product.reorder_level ?? 20));
    setEditStockUnitPrice(String(product.unit_price ?? 0));
    setEditStockWholesalePrice(String(product.wholesale_price ?? product.unit_price ?? 0));
    const isPreset = PRESET_UNITS.some((u) => u.value === product.unit);
    if (isPreset) {
      setIsCustomEditStockUnit(false);
      setCustomEditStockUnit("");
      setEditStockUnit(product.unit || "kg");
    } else {
      setIsCustomEditStockUnit(true);
      setCustomEditStockUnit(product.unit || "");
      setEditStockUnit(product.unit || "kg");
    }
    setEditStockReason("Physical inventory recount / audit");
    setEditStockNotes("");
    setEditStockModal(true);
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStockProduct?.id) {
      alert("No product selected");
      return;
    }
    const newOnHand = parseFloat(editStockOnHand);
    if (isNaN(newOnHand) || newOnHand < 0) {
      alert("Please enter a valid stock quantity (0 or greater)");
      return;
    }
    const newPrice = parseFloat(editStockUnitPrice);
    if (isNaN(newPrice) || newPrice <= 0) {
      alert("Please enter a valid Selling Price (₹)");
      return;
    }
    const newWholesale = parseFloat(editStockWholesalePrice);
    if (isNaN(newWholesale) || newWholesale <= 0) {
      alert("Please enter a valid Wholesale Price (₹)");
      return;
    }
    const newReorder = parseFloat(editStockReorder);

    try {
      const fullReason = [
        editStockReason,
        editStockNotes.trim() ? `Note: ${editStockNotes.trim()}` : "",
      ]
        .filter(Boolean)
        .join(" · ");

      const finalUnit = isCustomEditStockUnit
        ? customEditStockUnit.trim() || editStockUnit
        : editStockUnit;

      const updated = await updateProductStock({
        productId: editStockProduct.id,
        onHand: newOnHand,
        reorderLevel: isNaN(newReorder) ? undefined : newReorder,
        unitPrice: newPrice,
        wholesalePrice: newWholesale,
        unit: finalUnit,
        reason: fullReason,
        userName: currentUser?.name || "Warehouse Supervisor",
      });

      setDbProducts((prev) => prev.map((p) => (p.id === editStockProduct.id ? updated : p)));
      if (editStockProduct.id === updated.id) {
        setEditStockProduct(updated);
      }
      setEditStockModal(false);
      reloadData();
    } catch (err: unknown) {
      alert(`Failed to update stock: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleSaveVisit = async () => {
    if (!visitFirm) {
      alert("Please select a firm first.");
      return;
    }
    const clientName = visitSelectedCustomer;
    if (!clientName) {
      alert("Please select a client from the chosen firm.");
      return;
    }

    const matchedCust = dbCustomers.find(
      (c) =>
        c.name.toLowerCase() === clientName.toLowerCase() &&
        (c.company_id === visitFirm || company === "all"),
    );

    const effectivePurpose =
      visitPurpose === "Custom" ? visitCustomPurpose.trim() || "Client Meeting" : visitPurpose;

    await scheduleFieldVisit({
      companyId: visitFirm,
      customerName: clientName,
      customerId: matchedCust?.id,
      purpose: effectivePurpose,
      scheduledDate: (visitLogDate || new Date().toISOString().split("T")[0]) || "",
      scheduledTime:
        visitLogTime || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      assignedTo: currentUser?.id,
      assignedToName: currentUser?.name || "Ravi Kumar",
      creatorName: currentUser?.name || "Ravi Kumar",
      outcomeNotes: visitRequirement || "Visit completed on site.",
      gpsLatitude: gpsLocation?.lat || 12.9716,
      gpsLongitude: gpsLocation?.lng || 77.5946,
      photos: proofPhotos,
      voiceRecordingPath:
        voiceAudioDataUrl ||
        (hasVoiceNote ? `voice-memo-${recordingDuration || 8}s.m4a` : undefined),
      status: "Completed",
    });

    setVisitSuccessNotice(`Visit to "${clientName}" saved with on-site GPS & verification!`);
    setTimeout(() => setVisitSuccessNotice(null), 5000);
    setVisitRequirement("");
    setHasVoiceNote(false);
    setVoiceAudioDataUrl(null);
    setRecordingDuration(0);
    setGpsLocation(null);
    setProofPhotos([]);
    setVisitCustomPurpose("");
    setVisitLogDate(new Date().toISOString().split("T")[0]);
    setVisitLogTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    setTab("Visit history");
    reloadData();
  };

  const handleCreateOrderFromVisit = async () => {
    if (!visitFirm) {
      alert("Please pick a firm first.");
      return;
    }
    const clientName = visitSelectedCustomer;
    if (!clientName) {
      alert("Please select a client from the chosen firm.");
      return;
    }

    const matchedCust = dbCustomers.find(
      (c) =>
        c.name.toLowerCase() === clientName.toLowerCase() &&
        (c.company_id === visitFirm || company === "all"),
    );

    const effectivePurpose =
      visitPurpose === "Custom" ? visitCustomPurpose.trim() || "Client Meeting" : visitPurpose;

    await scheduleFieldVisit({
      companyId: visitFirm,
      customerName: clientName,
      customerId: matchedCust?.id,
      purpose: effectivePurpose,
      scheduledDate: new Date().toISOString().split("T")[0] || "",
      scheduledTime: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      assignedTo: currentUser?.id,
      assignedToName: currentUser?.name || "Ravi Kumar",
      creatorName: currentUser?.name || "Ravi Kumar",
      outcomeNotes: visitRequirement || "Order conversion initiated from field visit.",
      gpsLatitude: gpsLocation?.lat || 12.9716,
      gpsLongitude: gpsLocation?.lng || 77.5946,
      photos: proofPhotos,
      voiceRecordingPath:
        voiceAudioDataUrl ||
        (hasVoiceNote ? `voice-memo-${recordingDuration || 8}s.m4a` : undefined),
      status: "Completed",
    });

    setVisitCustomPurpose("");
    setVoiceAudioDataUrl(null);
    setHasVoiceNote(false);
    setProofPhotos([]);
    reloadData();

    navigateToCreateOrder({
      customerName: clientName,
      companyId: visitFirm,
      notes: visitRequirement || `Converted from field visit (${effectivePurpose})`,
    });
  };

  const openAddVehicleModal = () => {
    setEditingVehicle(null);
    setTruckName("");
    setTruckPlate("");
    setTruckDriverName("");
    setTruckDriverPhone("");
    setTruckCapacity("2.5 Tons");
    setTruckCompanyId(company !== "all" ? company : "asian");
    setTruckStatus("Available / At Godown");
    setVehicleModal(true);
  };

  const openEditVehicleModal = (veh: DBVehicle) => {
    setEditingVehicle(veh);
    setTruckName(veh.make_model || veh.name || "");
    setTruckPlate(veh.plate_number || "");
    setTruckDriverName(veh.assigned_driver_name || veh.driver_name || "");
    setTruckDriverPhone(veh.assigned_driver_phone || veh.driver_phone || "");
    setTruckCapacity(veh.capacity || "2.5 Tons");
    setTruckCompanyId(veh.company_id || "all");
    setTruckStatus(veh.status || "Available / At Godown");
    setVehicleModal(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckPlate.trim()) {
      alert("Please enter a vehicle plate number");
      return;
    }
    setVehicleSaving(true);
    try {
      if (editingVehicle) {
        await updateVehicle(editingVehicle.id, {
          companyId: truckCompanyId,
          plateNumber: truckPlate.trim(),
          makeModel: truckName.trim() || editingVehicle.make_model,
          capacity: truckCapacity.trim() || undefined,
          status: truckStatus,
          driverName: truckDriverName.trim() || undefined,
          driverPhone: truckDriverPhone.trim() || undefined,
          updatedByName: currentUser?.name || "Super Admin",
        });
      } else {
        await createVehicle({
          companyId: truckCompanyId,
          plateNumber: truckPlate.trim(),
          makeModel: truckName.trim() || "Commercial Truck",
          capacity: truckCapacity.trim() || "2.5 Tons",
          status: truckStatus,
          driverName: truckDriverName.trim() || undefined,
          driverPhone: truckDriverPhone.trim() || undefined,
          creatorName: currentUser?.name || "Super Admin",
        });
      }
      setVehicleModal(false);
      setEditingVehicle(null);
      reloadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setVehicleSaving(false);
    }
  };

  const handleDeleteVehicle = async (vehicle: DBVehicle) => {
    if (!isSuperAdmin) {
      alert("Only Super Admin can delete vehicles.");
      return;
    }
    setDeleteTarget({
      type: "Fleet Vehicle",
      id: vehicle.id,
      name: `${vehicle.plate_number} (${vehicle.make_model})`,
      onDelete: async () => {
        await deleteVehicle(vehicle.id, currentUser?.name);
        setDbVehicles((prev) => prev.filter((v) => v.id !== vehicle.id));
      },
    });
  };

  const handleMarkVehicleReturned = async (plateNumber?: string) => {
    if (!plateNumber) return;
    try {
      await updateVehicleStatus(
        plateNumber,
        "Returned to Godown",
        currentUser?.name || "Logistics",
        "Marked returned to godown after delivery completion",
      );
      reloadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalUnit = isCustomProdUnit ? customProdUnit.trim() || "units" : prodUnit;
    const sp = parseFloat(prodPrice);
    const wp = parseFloat(prodWholesalePrice);
    if (isNaN(sp) || sp <= 0) {
      alert("Please enter a valid Selling Price (₹)");
      return;
    }
    if (isNaN(wp) || wp <= 0) {
      alert("Please enter a valid Wholesale Price (₹)");
      return;
    }
    await createProduct({
      companyId: prodCompany,
      code: prodCode,
      name: prodName,
      category: prodCategory,
      unit: finalUnit,
      unitPrice: sp,
      wholesalePrice: wp,
      onHand: parseFloat(prodOnHand) || 0,
      reorderLevel: parseFloat(prodReorder) || 20,
      creatorName: currentUser?.name || "Ravi Kumar",
    });
    setProdModal(false);
    setProdCode("");
    setProdName("");
    setProdPrice("350");
    setProdWholesalePrice("300");
    setIsCustomProdUnit(false);
    setCustomProdUnit("");
    reloadData();
  };

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalPoUnit = isCustomPoUnit ? customPoUnit.trim() || "units" : poUnit;
    await createPurchaseOrder({
      companyId: poCompany,
      supplierName: poSupplier,
      productName: poProduct,
      quantity: parseFloat(poQuantity) || 10,
      unit: finalPoUnit,
      unitPrice: parseFloat(poPrice) || 100,
      creatorName: currentUser?.name || "Ravi Kumar",
    });
    setPoModal(false);
    setPoSupplier("");
    setPoProduct("");
    setIsCustomPoUnit(false);
    setCustomPoUnit("");
    reloadData();
  };

  const handleScheduleVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    await scheduleFieldVisit({
      companyId: visitFirm || "asian",
      customerName: visitCustomer,
      purpose: visitPurpose,
      scheduledDate: visitDate,
      scheduledTime: visitTime,
      assignedTo: currentUser?.id,
      assignedToName: currentUser?.name || "Ravi Kumar",
      creatorName: currentUser?.name || "Ravi Kumar",
    });
    setVisitModal(false);
    setVisitCustomer("");
    reloadData();
  };

  const handleCompleteVisitAction = async (v: DBFieldVisit) => {
    if (!v.id) return;
    await completeFieldVisit(
      v.id,
      "Client meeting completed successfully. Order requirements gathered.",
      "Ravi Kumar",
      v.company_id,
    );
    reloadData();
  };

  const handleReceiveGoods = async (po: DBPurchaseOrder) => {
    await receivePurchaseGoods(po.id, po.company_id, "Arun Nair (Supervisor)");
    reloadData();
  };

  const openEditPo = (po: DBPurchaseOrder) => {
    setEditingPo(po);
    setEditPoSupplier(po.supplier_name);
    setEditPoProduct(po.product_name);
    setEditPoQuantity(String(po.quantity));
    const isPreset = PRESET_UNITS.some((u) => u.value === po.unit);
    if (isPreset) {
      setIsCustomEditPoUnit(false);
      setCustomEditPoUnit("");
      setEditPoUnit(po.unit || "kg");
    } else {
      setIsCustomEditPoUnit(true);
      setCustomEditPoUnit(po.unit || "");
      setEditPoUnit(po.unit || "kg");
    }
    const totalPrice = po.total_price || 0;
    const unitPrice = po.quantity > 0 ? Math.round(totalPrice / po.quantity) : totalPrice;
    setEditPoPrice(String(unitPrice));
    setEditPoCompany(po.company_id);
    setEditPoStatus(po.status);
    setEditPoModal(true);
  };

  const handleUpdatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPo) return;
    const qty = parseFloat(editPoQuantity);
    const unitRate = parseFloat(editPoPrice);
    if (isNaN(qty) || qty <= 0) {
      alert("Please enter a valid quantity");
      return;
    }
    if (isNaN(unitRate) || unitRate < 0) {
      alert("Please enter a valid unit price");
      return;
    }
    const finalUnit = isCustomEditPoUnit ? customEditPoUnit.trim() || editPoUnit : editPoUnit;

    try {
      const updated = await updatePurchaseOrder({
        id: editingPo.id,
        companyId: editPoCompany,
        supplierName: editPoSupplier,
        productName: editPoProduct,
        quantity: qty,
        unit: finalUnit,
        unitPrice: unitRate,
        updaterName: currentUser?.name || "Admin",
      });

      setDbPOs((prev) => prev.map((p) => (p.id === editingPo.id ? updated : p)));
      setEditPoModal(false);
      setEditingPo(null);
      reloadData();
    } catch (err: unknown) {
      alert(`Failed to update Purchase Order: ${err instanceof Error ? err.message : "Error"}`);
    }
  };

  const openEditVisit = (v: DBFieldVisit) => {
    setEditingVisit(v);
    setEditVisitDate(v.scheduled_date || new Date().toISOString().split("T")[0] || "");
    setEditVisitTime(v.scheduled_time || "10:00 AM");
    setEditVisitPurpose(v.purpose || "Follow-up");
    const cleanNotes = (v.outcome_notes || "")
      .replace(/\n?\[Edited once.*?\]/g, "")
      .replace(/\n?\[Edited on.*?\]/g, "")
      .trim();
    setEditVisitNotes(cleanNotes);
    setEditVisitModal(true);
  };

  const handleUpdateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVisit?.id) return;
    try {
      const isSalesUser = currentUser?.role === "sales";
      const tag = isSalesUser
        ? `\n[Edited once on ${new Date().toLocaleDateString()} by ${currentUser?.name || "Sales"}]`
        : `\n[Edited on ${new Date().toLocaleDateString()} by ${currentUser?.name || "Supervisor"}]`;
      const finalNotes = `${editVisitNotes.trim()}${tag}`;

      const updated = await updateFieldVisit({
        id: editingVisit.id,
        scheduledDate: editVisitDate,
        scheduledTime: editVisitTime,
        purpose: editVisitPurpose,
        outcomeNotes: finalNotes,
        updaterName: currentUser?.name || "User",
      });

      setDbVisits((prev) => prev.map((v) => (v.id === editingVisit.id ? updated : v)));
      setEditVisitModal(false);
      setEditingVisit(null);
      setVisitSuccessNotice("Field visit log updated successfully.");
      setTimeout(() => setVisitSuccessNotice(null), 5000);
      reloadData();
    } catch (err: unknown) {
      alert(`Failed to update field visit: ${err instanceof Error ? err.message : "Error"}`);
    }
  };

  const openDispatchModal = (o: DBOrder) => {
    setSelectedOrderForDispatch(o);
    if (o.transport_mode === "Manufacturer Vehicle") {
      setVehicleNo("Manufacturer Arranged");
      setDriverName(o.assigned_driver || "Manufacturer Representative");
      setDriverPhone(o.assigned_driver_phone || "");
    } else if (o.assigned_vehicle && o.assigned_vehicle !== "Manufacturer Arranged") {
      setVehicleNo(o.assigned_vehicle);
      setDriverName(o.assigned_driver || "");
      setDriverPhone(o.assigned_driver_phone || "");
    } else {
      const avail = dbVehicles.find((v) => v.status !== "Dispatched / On Delivery");
      if (avail) {
        setVehicleNo(avail.plate_number);
        setDriverName(avail.assigned_driver_name || avail.driver_name || "Mahesh Patel");
        setDriverPhone(avail.assigned_driver_phone || avail.driver_phone || "+91 98450 33445");
      } else {
        setVehicleNo("");
        setDriverName("");
        setDriverPhone("");
      }
    }
    setDispatchModal(true);
  };

  const handleDispatchOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForDispatch) return;
    const matchingInv = dbInvoices.find(
      (i) =>
        i.order_id === selectedOrderForDispatch.id ||
        i.id === `INV-${selectedOrderForDispatch.id.replace("ORD-", "")}`,
    );

    const effVehicleNo =
      selectedOrderForDispatch.transport_mode === "Manufacturer Vehicle"
        ? "Manufacturer Arranged"
        : vehicleNo;

    try {
      await dispatchDelivery({
        orderId: selectedOrderForDispatch.id,
        companyId: selectedOrderForDispatch.company_id,
        invoiceId: matchingInv?.id,
        vehicleNumber: effVehicleNo,
        driverName: driverName,
        driverPhone: driverPhone,
        deliveryDate: dispatchDate,
        timeWindow: dispatchTimeWindow,
        dispatcherName: currentUser?.name || "Order Desk",
        dispatcherRole: currentUser?.role || "super_admin",
      });
      setDispatchModal(false);
      setSelectedOrderForDispatch(null);
      reloadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleOpenPodModal = (delivery: DBDelivery) => {
    setSelectedDeliveryForPod(delivery);
    const ord = dbOrders.find((o) => o.id === delivery.order_id);
    const parsedQty = ord ? parseFloat(ord.items_summary?.match(/(\d+)/)?.[1] || "1") : 1;
    setPodDeliveredQty(String(parsedQty));
    setPodRemainingQty("0");
    setPodOutcome("Delivered");
    setPodReceiverName(ord?.contact_person || ord?.customer_name || "");
    setPodReceiverPhone("");
    setPodFailureReason("Customer unavailable / door locked");
    setPodReturnNotes("");
    setPodRemarks("");
    setPodPhotoPreview(null);
    setPodPhotoUrls([]);
    setPodGps(null);
    setPodGpsError("");
    setPodPhotoError("");
    setPodModal(true);
    capturePodLocation();
  };

  const capturePodLocation = () => {
    setPodGpsError("");
    if (!navigator.geolocation) {
      setPodGps(null);
      setPodGpsError("This device cannot share location. Allow location to finish the delivery.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPodGps({
          lat: Number(pos.coords.latitude.toFixed(4)),
          lng: Number(pos.coords.longitude.toFixed(4)),
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        });
        setPodGpsError("");
      },
      (err) => {
        setPodGps(null);
        setPodGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Allow location access in the browser, then try again."
            : "Could not read the delivery location. Turn location on and try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const handlePodPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type && !file.type.startsWith("image/")) {
      setPodPhotoError("Take a delivery photo with the camera.");
      return;
    }
    const dataUrl = await processImageFile(file);
    if (!dataUrl) {
      setPodPhotoError("Could not read that photo. Take it again with the camera.");
      return;
    }
    setPodPhotoError("");
    setPodPhotoPreview(dataUrl);
    setPodPhotoUrls([dataUrl]);
  };

  const handleSubmittingPod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeliveryForPod) return;
    if (!deliveryProofReady(podGps, podPhotoUrls)) {
      if (!podGps) setPodGpsError("Capture the delivery location before submitting.");
      if (podPhotoUrls.length === 0) setPodPhotoError("Take a delivery photo before submitting.");
      return;
    }
    const delQty = parseFloat(podDeliveredQty) || 0;
    const remQty = parseFloat(podRemainingQty) || 0;

    await completeDelivery({
      deliveryId: selectedDeliveryForPod.id || `DEL-${selectedDeliveryForPod.order_id}`,
      orderId: selectedDeliveryForPod.order_id,
      companyId: selectedDeliveryForPod.company_id,
      outcome: podOutcome,
      deliveredQuantity: delQty,
      remainingQuantity: remQty,
      receiverName: podReceiverName,
      receiverPhone: podReceiverPhone,
      failureReason: podOutcome === "Failed" ? podFailureReason : undefined,
      returnGoodsNotes: podReturnNotes || undefined,
      latitude: podGps?.lat,
      longitude: podGps?.lng,
      photoDataUrls: podPhotoUrls,
      remarks:
        podRemarks ||
        (podOutcome === "Delivered"
          ? "Delivered in full. Recipient verified."
          : podOutcome === "Partially Delivered"
            ? `Partial delivery: ${delQty} delivered, ${remQty} returned.`
            : `Delivery failed: ${podFailureReason}`),
      completedByName: currentUser?.name || "Mahesh Patel (Logistics)",
    });

    setPodModal(false);
    setSelectedDeliveryForPod(null);
    reloadData();
  };

  const handleOpenInvoiceModal = (orderId: string) => {
    const ord = dbOrders.find((o) => o.id === orderId);
    const inv = dbInvoices.find(
      (i) => i.order_id === orderId || i.id === `INV-${orderId.replace("ORD-", "")}`,
    );
    setViewingOrder(ord || null);
    setViewingInvoice(inv || null);
    setInvoiceViewModal(true);
  };

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;
    const amount = parseFloat(payAmount) || selectedInvoiceForPayment.remaining_amount;
    await recordPayment({
      invoiceId: selectedInvoiceForPayment.id,
      companyId: selectedInvoiceForPayment.company_id,
      customerId: selectedInvoiceForPayment.customer_id,
      amount,
      paymentMethod: payMethod,
      referenceNumber: payRef,
      recordedByName: "Suresh Rao (Accounts)",
    });
    setPaymentModal(false);
    setSelectedInvoiceForPayment(null);
    setPayAmount("");
    reloadData();
  };

  const totalCollectedRevenue = dbInvoices.reduce(
    (sum, i) => sum + (Number(i.paid_amount) || 0),
    0,
  );
  const totalOutstanding = dbInvoices.reduce(
    (sum, i) => sum + (Number(i.remaining_amount) || 0),
    0,
  );

  const modulePermissions: Record<string, string> = {
    tasks: "tasks.view",
    leads: "leads.view",
    customers: "customers.view",
    "field-visits": "field_visits.view",
    orders: "orders.view",
    inventory: "inventory.view",
    purchases: "purchases.view",
    logistics: "logistics.view",
    accounts: "invoices.view",
    credit: "credit.view",
    analytics: "analytics.view",
    administration: "admin.manage",
  };

  const requiredModulePerm = modulePermissions[module];
  const isModuleAllowed =
    module === "administration"
      ? isSuperAdmin || isSupervisor || hasPermission("admin.manage")
      : !requiredModulePerm || hasPermission(requiredModulePerm);

  if (!isModuleAllowed) {
    return (
      <main className="content">
        <p className="eyebrow mb-2">
          {company === "all"
            ? "Organization workspace"
            : companies.find((c) => c.id === company)?.short}
        </p>
        <h1 className="page-heading">{titles[module] || module}</h1>
        <div className="mt-8 max-w-md mx-auto text-center p-8 rounded-2xl border border-border bg-card shadow-sm space-y-4">
          <div className="size-12 rounded-full bg-warning/15 text-warning flex items-center justify-center mx-auto">
            <Lock className="size-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Access Restricted</h2>
            <p className="text-xs text-muted-foreground mt-1.5">
              <strong>{currentUser?.roleName || "This login"}</strong> does not include this
              feature.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button size="sm" variant="outline" asChild>
              <a href="/">Return to Overview</a>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const handleDownloadInvoice = (inv: DBInvoice, ord?: DBOrder | null) => {
    const comp = companies.find((c) => c.id === inv.company_id);
    const orderDetails = ord || dbOrders.find((o) => o.id === inv.order_id);
    const issueDate = inv.created_at
      ? inv.created_at.split("T")[0]
      : new Date().toISOString().split("T")[0];
    const dueDate = inv.due_date || "Within 15 Days";
    const subtotal = orderDetails?.subtotal || inv.amount * 0.8475;
    const tax = orderDetails?.tax || inv.amount * 0.1525;
    const cgst = tax / 2;
    const sgst = tax / 2;
    const total = inv.amount;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - #${inv.id}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background: #fff; color: #1e293b; padding: 24px; line-height: 1.4; font-size: 13px; }
    .invoice-card { max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; }
    .company-title { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .badge-gst { display: inline-block; background: #f1f5f9; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; color: #475569; margin-top: 6px; }
    .inv-header-right { text-align: right; }
    .inv-title { font-size: 24px; font-weight: 800; color: #15803d; letter-spacing: -0.5px; text-transform: uppercase; }
    .inv-meta { margin-top: 6px; font-size: 12px; color: #475569; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 24px 0; padding: 16px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; }
    .sec-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 4px; }
    .name-bold { font-size: 15px; font-weight: 700; color: #0f172a; }
    .meta-text { font-size: 12px; color: #475569; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    th { background: #0f172a; color: #fff; text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #334155; }
    .num { text-align: right; }
    .totals-area { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 16px; }
    .bank-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; width: 48%; font-size: 11px; }
    .totals-box { width: 45%; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 12px; color: #475569; }
    .totals-row.grand { border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; font-size: 16px; font-weight: 800; color: #0f172a; padding: 10px 0; margin-top: 8px; }
    .footer { margin-top: 36px; padding-top: 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-end; }
    .sign-box { text-align: right; }
    .sign-line { width: 180px; border-top: 1px solid #0f172a; margin-top: 48px; padding-top: 4px; font-size: 11px; font-weight: 600; color: #334155; }
    .no-print-bar { background: #0f172a; color: #fff; padding: 12px 24px; margin-bottom: 20px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
    .print-btn { background: #22c55e; color: #fff; border: none; padding: 8px 16px; border-radius: 4px; font-weight: 700; cursor: pointer; font-size: 13px; }
    @media print {
      body { padding: 0; }
      .invoice-card { border: none; padding: 0; }
      .no-print-bar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><strong>Tax Invoice Preview:</strong> #${inv.id} &mdash; ${inv.customer_name}</div>
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="company-title">${comp?.name || "Avighna Food Products Pvt Ltd"}</div>
        <div class="meta-text">Corporate Office: Plot 42-A, Industrial Growth Centre, Phase II</div>
        <div class="meta-text">Phone: +91 98201 44520 &bull; Email: billing@avighnaone.com</div>
        <div class="badge-gst">GSTIN: 27AABCA1234F1ZX &bull; State Code: 27 (Maharashtra)</div>
      </div>
      <div class="inv-header-right">
        <div class="inv-title">TAX INVOICE</div>
        <div class="inv-meta"><strong>Invoice No:</strong> #${inv.id}</div>
        <div class="inv-meta"><strong>Issue Date:</strong> ${issueDate}</div>
        <div class="inv-meta"><strong>Due Date:</strong> ${dueDate}</div>
        <div class="inv-meta"><strong>Status:</strong> ${inv.status.toUpperCase()}</div>
      </div>
    </div>

    <div class="grid-2">
      <div>
        <div class="sec-label">Billed To (Customer):</div>
        <div class="name-bold">${inv.customer_name}</div>
        <div class="meta-text">${orderDetails?.delivery_address || "Client Warehouse & Receiving Hub"}</div>
        <div class="meta-text">Contact: ${orderDetails?.contact_person || "Accounts / Procurement"}</div>
        <div class="meta-text">GSTIN: 27BBDCE9876K1Z8</div>
      </div>
      <div>
        <div class="sec-label">Dispatched From & Order Details:</div>
        <div class="name-bold">${comp?.short || "Avighna"} Central Distribution Hub</div>
        <div class="meta-text"><strong>Sales Order:</strong> #${inv.order_id || (orderDetails ? orderDetails.id : "N/A")}</div>
        <div class="meta-text"><strong>Payment Terms:</strong> Net 15 Days B2B Commercial</div>
        <div class="meta-text"><strong>Place of Supply:</strong> Maharashtra (27)</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Description of Goods</th>
          <th>HSN/SAC</th>
          <th class="num">Qty</th>
          <th class="num">Rate (₹)</th>
          <th class="num">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td><strong>${orderDetails?.items_summary || "Commercial B2B Food & Industrial Raw Supplies"}</strong></td>
          <td>0402</td>
          <td class="num">1 Lot</td>
          <td class="num">${Math.round(subtotal).toLocaleString("en-IN")}</td>
          <td class="num">${Math.round(subtotal).toLocaleString("en-IN")}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals-area">
      <div class="bank-box">
        <div class="sec-label" style="margin-bottom: 8px;">Bank & Remittance Details:</div>
        <div><strong>Bank Name:</strong> HDFC Bank Ltd</div>
        <div><strong>A/C Name:</strong> ${comp?.name || "Avighna Food Products Pvt Ltd"}</div>
        <div><strong>Account No:</strong> 50200088921478</div>
        <div><strong>IFSC Code:</strong> HDFC0001248</div>
        <div><strong>Branch:</strong> Andheri East Industrial Estate, Mumbai</div>
      </div>
      <div class="totals-box">
        <div class="totals-row">
          <span>Taxable Subtotal:</span>
          <span>₹${Math.round(subtotal).toLocaleString("en-IN")}</span>
        </div>
        <div class="totals-row">
          <span>CGST (9.0%):</span>
          <span>₹${Math.round(cgst).toLocaleString("en-IN")}</span>
        </div>
        <div class="totals-row">
          <span>SGST (9.0%):</span>
          <span>₹${Math.round(sgst).toLocaleString("en-IN")}</span>
        </div>
        <div class="totals-row grand">
          <span>Grand Total:</span>
          <span>₹${Number(total).toLocaleString("en-IN")}</span>
        </div>
        <div class="totals-row" style="margin-top: 6px; font-weight: 700; color: #15803d;">
          <span>Remaining Balance:</span>
          <span>₹${Number(inv.remaining_amount).toLocaleString("en-IN")}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <div>
        <div style="font-size: 11px; font-weight: 600; color: #475569;">Terms & Conditions:</div>
        <div style="font-size: 10px; color: #64748b; max-width: 450px; margin-top: 4px;">
          1. Goods once sold will be accepted back only in accordance with credit note policy.<br>
          2. Interest @ 18% p.a. will be levied on delayed payments beyond credit period.<br>
          3. Subject to local jurisdiction only.
        </div>
      </div>
      <div class="sign-box">
        <div style="font-size: 11px; font-weight: 700;">For ${comp?.short || "Avighna"} Enterprise</div>
        <div class="sign-line">Authorized Signatory / Accounts</div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }

    try {
      const blob = new Blob([htmlContent], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Invoice_${inv.id}_${inv.customer_name.replace(/[^a-zA-Z0-9]/g, "_")}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn("Direct blob download notice", e);
    }
  };

  // Credit calculations
  const customersForCredit = useMemo(() => {
    return company === "all" ? dbCustomers : dbCustomers.filter((c) => c.company_id === company);
  }, [dbCustomers, company]);

  const creditPositions = useMemo(() => {
    const today = new Date().toISOString().split("T")[0] || "";
    return customersForCredit.map((c) => {
      const limit = Number(c.credit_limit) || 500000;
      const days = Number(c.credit_days) || 30;

      const custInvoices = dbInvoices.filter(
        (i) =>
          (c.name && i.customer_name?.toLowerCase().trim() === c.name.toLowerCase().trim()) ||
          (c.id && i.customer_id === c.id),
      );

      const outstanding = custInvoices.reduce(
        (sum, i) => sum + (Number(i.remaining_amount) || 0),
        0,
      );

      const overdue = custInvoices
        .filter((i) => i.status !== "Paid" && i.due_date && i.due_date < today)
        .reduce((sum, i) => sum + (Number(i.remaining_amount) || 0), 0);

      const headroom = Math.max(0, limit - outstanding);

      let status: "Within limit" | "Near limit" | "Limit breached" = "Within limit";
      if (outstanding > limit) {
        status = "Limit breached";
      } else if (limit > 0 && outstanding >= limit * 0.8) {
        status = "Near limit";
      }

      return {
        customer: c,
        limit,
        days,
        outstanding,
        overdue,
        headroom,
        status,
      };
    });
  }, [customersForCredit, dbInvoices]);

  const limitAlertsCount = useMemo(() => {
    return creditPositions.filter((p) => p.status === "Limit breached" || p.status === "Near limit")
      .length;
  }, [creditPositions]);

  const filteredCreditPositions = useMemo(() => {
    return creditPositions.filter((p) => {
      const matchesSearch =
        creditSearch === "" ||
        p.customer.name.toLowerCase().includes(creditSearch.toLowerCase()) ||
        (p.customer.contact_person &&
          p.customer.contact_person.toLowerCase().includes(creditSearch.toLowerCase()));

      let matchesStatus = true;
      if (creditStatusFilter === "within") matchesStatus = p.status === "Within limit";
      else if (creditStatusFilter === "near") matchesStatus = p.status === "Near limit";
      else if (creditStatusFilter === "breached") matchesStatus = p.status === "Limit breached";

      let matchesBalance = true;
      if (creditBalanceFilter === "outstanding") matchesBalance = p.outstanding > 0;
      else if (creditBalanceFilter === "zero") matchesBalance = p.outstanding === 0;

      return matchesSearch && matchesStatus && matchesBalance;
    });
  }, [creditPositions, creditSearch, creditStatusFilter, creditBalanceFilter]);

  const handlePostCreditNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(noteAmount);
    if (!parsedAmount || parsedAmount <= 0) return;

    const inv = dbInvoices.find((i) => i.id === noteInvoiceId);
    const targetCustomerName = inv ? inv.customer_name : "General Customer";
    const targetCompanyId = inv ? inv.company_id : company === "all" ? "asian" : company;

    setPostingNote(true);
    try {
      const newNote = await createCreditNote({
        companyId: targetCompanyId,
        customerName: targetCustomerName,
        invoiceId: noteInvoiceId || undefined,
        type: noteType,
        reason: noteReason,
        amount: parsedAmount,
        userName: currentUser?.name || "Super Admin",
      });
      setDbCreditNotes((prev) => [newNote, ...prev]);
      setNoteAmount("");
      setNoteInvoiceId("");
    } catch (err) {
      console.error(err);
    } finally {
      setPostingNote(false);
    }
  };

  const handleSaveCreditLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCreditCustomer || !selectedCreditCustomer.id) return;
    const parsedLimit = parseFloat(editCreditLimit);
    const parsedDays = parseInt(editCreditDays, 10);
    if (isNaN(parsedLimit) || isNaN(parsedDays)) return;

    setSavingCreditLimit(true);
    try {
      const updated = await updateCustomerCreditLimit(
        selectedCreditCustomer.id,
        parsedLimit,
        parsedDays,
        currentUser?.name || "Super Admin",
      );
      setDbCustomers((prev) =>
        prev.map((c) =>
          c.id === updated.id
            ? { ...c, credit_limit: updated.credit_limit, credit_days: updated.credit_days }
            : c,
        ),
      );
      setEditCreditModal(false);
      setSelectedCreditCustomer(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingCreditLimit(false);
    }
  };

  // Invoices & accounts desk helpers
  const companyInvoices = useMemo(() => {
    return company === "all" ? dbInvoices : dbInvoices.filter((i) => i.company_id === company);
  }, [dbInvoices, company]);

  const companyDeliveries = useMemo(() => {
    return company === "all" ? dbDeliveries : dbDeliveries.filter((d) => d.company_id === company);
  }, [dbDeliveries, company]);

  const ordersReadyToInvoice = useMemo(() => {
    return dbOrders.filter((o) => {
      const matchesCompany = company === "all" || o.company_id === company;
      const isApprovedOrDispatch = [
        "Approved",
        "Ready to dispatch",
        "Out for delivery",
        "Delivered",
      ].includes(o.status);
      const isNotInvoiced = !dbInvoices.some(
        (inv) => inv.order_id === o.id || inv.id === `INV-${o.id.replace("ORD-", "")}`,
      );
      return matchesCompany && isApprovedOrDispatch && isNotInvoiced;
    });
  }, [dbOrders, dbInvoices, company]);

  const filteredReadyOrders = useMemo(() => {
    return ordersReadyToInvoice.filter((o) => {
      const comp = companies.find((c) => c.id === o.company_id);
      const matchesSearch =
        readyToInvoiceSearch === "" ||
        `${o.id} ${o.customer_name} ${comp?.name || ""} ${comp?.short || ""}`
          .toLowerCase()
          .includes(readyToInvoiceSearch.toLowerCase());

      const cust = dbCustomers.find(
        (c) =>
          c.name?.toLowerCase().trim() === o.customer_name?.toLowerCase().trim() ||
          c.id === o.customer_id,
      );
      const custLimit = Number(cust?.credit_limit) || 500000;
      const custInvoices = dbInvoices.filter(
        (i) =>
          (cust?.name &&
            i.customer_name?.toLowerCase().trim() === cust.name.toLowerCase().trim()) ||
          (cust?.id && i.customer_id === cust.id),
      );
      const outstanding = custInvoices.reduce((s, i) => s + (Number(i.remaining_amount) || 0), 0);
      let creditStatus = "Within limit";
      if (outstanding > custLimit) creditStatus = "Limit breached";
      else if (custLimit > 0 && outstanding >= custLimit * 0.8) creditStatus = "Near limit";

      let matchesCredit = true;
      if (readyToInvoiceCreditFilter === "Within limit")
        matchesCredit = creditStatus === "Within limit";
      else if (readyToInvoiceCreditFilter === "Near limit")
        matchesCredit = creditStatus === "Near limit";
      else if (readyToInvoiceCreditFilter === "Limit breached")
        matchesCredit = creditStatus === "Limit breached";

      return matchesSearch && matchesCredit;
    });
  }, [
    ordersReadyToInvoice,
    readyToInvoiceSearch,
    readyToInvoiceCreditFilter,
    dbCustomers,
    dbInvoices,
  ]);

  const filteredIssuedInvoices = useMemo(() => {
    const today = new Date().toISOString().split("T")[0] || "";
    const now = Date.now();

    return companyInvoices.filter((inv) => {
      const matchesSearch =
        invoiceSearch === "" ||
        `${inv.id} ${inv.customer_name} ${inv.order_id || ""}`
          .toLowerCase()
          .includes(invoiceSearch.toLowerCase());

      let matchesStatus = true;
      if (invoiceStatusFilter === "Unpaid") {
        matchesStatus =
          (inv.status as string) === "Unpaid" || (inv.remaining_amount === inv.amount && inv.status !== "Paid");
      } else if (invoiceStatusFilter === "Partially paid") {
        matchesStatus =
          inv.status === "Partially Paid" ||
          (inv.remaining_amount > 0 && inv.remaining_amount < inv.amount);
      } else if (invoiceStatusFilter === "Paid") {
        matchesStatus = inv.status === "Paid" || inv.remaining_amount === 0;
      } else if (invoiceStatusFilter === "Overdue") {
        matchesStatus =
          inv.status === "Overdue" ||
          Boolean(inv.due_date && inv.due_date < today && inv.remaining_amount > 0);
      } else if (invoiceStatusFilter === "Cancelled") {
        matchesStatus = (inv.status as string) === "Cancelled";
      }

      let matchesDate = true;
      if (invoiceDateFilter !== "All dates") {
        const invDate = inv.created_at ? new Date(inv.created_at) : new Date();
        const diffDays = Math.floor((now - invDate.getTime()) / (1000 * 60 * 60 * 24));
        if (invoiceDateFilter === "Today") {
          matchesDate = inv.created_at?.split("T")[0] === today;
        } else if (invoiceDateFilter === "This week") {
          matchesDate = diffDays <= 7;
        } else if (invoiceDateFilter === "This month") {
          matchesDate = diffDays <= 31 && invDate.getMonth() === new Date().getMonth();
        } else if (invoiceDateFilter === "Last 30 days") {
          matchesDate = diffDays <= 30;
        }
      }

      let matchesOverdueOnly = true;
      if (invoiceOverdueOnly) {
        matchesOverdueOnly = Boolean(
          inv.due_date && inv.due_date < today && inv.remaining_amount > 0,
        );
      }

      return matchesSearch && matchesStatus && matchesDate && matchesOverdueOnly;
    });
  }, [companyInvoices, invoiceSearch, invoiceStatusFilter, invoiceDateFilter, invoiceOverdueOnly]);

  const handleOpenRaiseInvoiceModal = (o: DBOrder) => {
    setSelectedOrderForInvoice(o);
    setCustomInvoiceNumber(`INV-${o.id.replace("ORD-", "")}`);
    const cust = dbCustomers.find(
      (c) =>
        (o.customer_id && c.id === o.customer_id) ||
        c.name.trim().toLowerCase() === o.customer_name.trim().toLowerCase(),
    );
    const due = new Date();
    due.setDate(due.getDate() + (Number(cust?.credit_days) || 30));
    setCustomDueDate(due.toISOString().split("T")[0] || "");
    setCustomBillNotes("Standard Tax Invoice against Verified Order");
    setRaiseInvoiceModal(true);
  };

  const handleConfirmRaiseInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForInvoice) return;
    setRaisingInvoice(true);
    try {
      await generateInvoice(selectedOrderForInvoice, currentUser?.name || "Suresh Rao (Accounts)", {
        invoiceId: customInvoiceNumber,
        dueDate: customDueDate,
        notes: customBillNotes,
      });
      setRaiseInvoiceModal(false);
      setSelectedOrderForInvoice(null);
      reloadData();
    } catch (err) {
      console.error(err);
    } finally {
      setRaisingInvoice(false);
    }
  };

  return (
    <main className="content">
      <p className="eyebrow mb-2">
        {company === "all"
          ? "Organization workspace"
          : companies.find((c) => c.id === company)?.short}
      </p>
      <h1 className="page-heading">{titles[module]}</h1>
      <p className="mt-2 text-xs text-muted-foreground">{subtitle[module]}</p>

      {module !== "credit" ? (
        <div className="flex items-center justify-between gap-4 flex-wrap my-6 pb-3 border-b border-border/60">
          <div className="flex items-center gap-3 flex-wrap">
            {(module === "administration"
              ? isSuperAdmin
                ? ["Companies", "Users", "Fleet", "Roles", "Audit"]
                : ["Team logins"]
              : module === "field-visits"
                ? ["Visit history", "Log a visit"]
                : module === "accounts"
                  ? [
                      "All sections",
                      "Ready to invoice",
                      "Dispatch inbox",
                      "Issued invoices",
                      "Payment Collections",
                    ]
                  : module === "analytics"
                    ? [
                        "Revenue Trends",
                        "Company Comparison",
                        "Product Performance",
                        "Conversion Funnel",
                      ]
                    : module === "leads"
                      ? ["Pipeline", "List"]
                      : ["Overview"]
            ).map((t) => {
              const isSelected =
                tab === t ||
                (module === "administration" &&
                  tab === "Overview" &&
                  t === (isSuperAdmin ? "Companies" : "Team logins")) ||
                (module === "field-visits" && tab === "Overview" && t === "Visit history") ||
                (module === "leads" && tab === "Overview" && t === "Pipeline") ||
                (module === "accounts" &&
                  (tab === "Overview" ||
                    tab === "Receivables" ||
                    tab === "Invoices & Receivables") &&
                  t === "All sections") ||
                (module === "analytics" && tab === "Overview" && t === "Revenue Trends");

              const getIcon = (label: string) => {
                switch (label) {
                  case "All sections":
                    return <Columns3 className="size-3.5" />;
                  case "Issued invoices":
                    return <FileCheck2 className="size-3.5" />;
                  case "Ready to invoice":
                    return <Clock className="size-3.5" />;
                  case "Dispatch inbox":
                    return <Truck className="size-3.5" />;
                  case "Pipeline":
                    return <Columns3 className="size-3.5" />;
                  case "List":
                    return <List className="size-3.5" />;
                  case "Companies":
                    return <Building2 className="size-3.5" />;
                  case "Users":
                    return <Users className="size-3.5" />;
                  case "Fleet":
                    return <Truck className="size-3.5" />;
                  case "Roles":
                    return <ShieldCheck className="size-3.5" />;
                  case "Audit":
                    return <FileText className="size-3.5" />;
                  case "Visit history":
                    return <History className="size-3.5" />;
                  case "Log a visit":
                    return <Plus className="size-3.5" />;
                  case "Invoices & Receivables":
                    return <FileCheck2 className="size-3.5" />;
                  case "Payment Collections":
                    return <IndianRupee className="size-3.5" />;
                  case "Awaiting Invoicing":
                    return <Clock className="size-3.5" />;
                  case "Revenue Trends":
                    return <TrendingUp className="size-3.5" />;
                  case "Company Comparison":
                    return <BarChart3 className="size-3.5" />;
                  case "Product Performance":
                    return <Package className="size-3.5" />;
                  case "Conversion Funnel":
                    return <Target className="size-3.5" />;
                  default:
                    return null;
                }
              };

              return (
                <Button
                  key={t}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  className={`h-9 px-4 text-xs font-bold gap-2 cursor-pointer transition-all shadow-xs ${
                    isSelected
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 ring-2 ring-primary/25"
                      : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted/60 border-border"
                  }`}
                  onClick={() => setTab(t)}
                >
                  {getIcon(t)}
                  <span>{t}</span>
                </Button>
              );
            })}
          </div>
          {module === "leads" && (
            <Button
              size="sm"
              onClick={() => setLeadModal(true)}
              className="h-9 gap-2 px-4 text-xs font-bold shrink-0 shadow-xs cursor-pointer"
            >
              <Plus className="size-3.5" />
              Add Lead
            </Button>
          )}
          {module === "field-visits" &&
            tab !== "Log a visit" &&
            hasPermission("field_visits.conduct") && (
              <Button
                size="sm"
                onClick={() => setTab("Log a visit")}
                className="h-9 gap-2 px-4 text-xs font-bold shrink-0 shadow-xs cursor-pointer"
              >
                <Plus className="size-3.5" />
                Log Field Visit
              </Button>
            )}
        </div>
      ) : (
        <div className="mt-6" />
      )}

      {module === "tasks" ? (
        <TaskWorkspace />
      ) : module === "orders" ? (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <input
                className="pl-10 text-xs"
                aria-label="Search orders"
                placeholder="Search orders or customers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Filter order status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="text-xs"
            >
              <option>All statuses</option>
              {Array.from(new Set(dbOrders.map((o) => o.status))).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <span className="ml-auto text-xs text-muted-foreground">{rows.length} orders</span>
          </div>
          <section className="panel">
            <OrderTable
              rows={rows}
              onRefresh={reloadData}
              initialCustomerName={routerSearch?.["customer"]}
              initialCompanyId={routerSearch?.["company"]}
              initialNotes={routerSearch?.["notes"]}
              openCreateOnMount={routerSearch?.["openCreate"] === "true"}
            />
          </section>
        </>
      ) : module === "customers" ? (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {dbCustomers.length} active customer accounts
            </span>
            {hasPermission("customers.manage") && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold"
                onClick={() => setCustModal(true)}
              >
                <Plus className="size-3.5" />
                Add customer
              </Button>
            )}
          </div>
          <div className="module-grid">
            {dbCustomers.map((c) => {
              const matchingLead = dbLeads.find(
                (l) =>
                  l.converted_customer_id === c.id ||
                  (l.business_name && l.business_name.toLowerCase() === c.name.toLowerCase()) ||
                  (l.contact_person &&
                    c.contact_person &&
                    l.contact_person.toLowerCase() === c.contact_person.toLowerCase()),
              );
              const cardPhone = c.phone || matchingLead?.phone || "";
              const cardEmail = c.email || matchingLead?.email || "";
              const cardAddress = c.address || matchingLead?.city || "";
              const cardContact = c.contact_person || matchingLead?.contact_person || "—";

              return (
                <article
                  className="module-item cursor-pointer hover:border-primary/60 hover:shadow-md transition-all group select-none flex flex-col justify-between"
                  key={c.id || c.name}
                  onClick={() => setSelectedCustomerDetails(c)}
                  title={`Click to view customer details & history for ${c.name}`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="avatar size-10 text-xs font-bold group-hover:scale-105 transition-transform">
                        {c.initials}
                      </span>
                      <span className="status success">{c.status}</span>
                    </div>
                    <h2 className="mt-4 font-bold text-base text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                      <span>{c.name}</span>
                      <ArrowRight className="size-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                    </h2>
                    {c.id && (
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">ID {c.id}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                      <Building2 className="size-3 text-primary shrink-0" />
                      <span>
                        {companies.find((co) => co.id === c.company_id)?.name || "Asian Apex & Co."}
                      </span>
                    </p>

                    <div className="mt-4 border-t border-border pt-3 space-y-2 text-xs">
                      {/* Contact Person */}
                      <div className="text-muted-foreground flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Users className="size-3 text-primary shrink-0" /> Contact:
                        </span>
                        <span className="text-foreground font-semibold">{cardContact}</span>
                      </div>

                      {/* Phone */}
                      <div className="text-muted-foreground flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Phone className="size-3 text-primary shrink-0" /> Phone:
                        </span>
                        {cardPhone ? (
                          <span className="text-foreground font-mono font-bold">{cardPhone}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditCustomer(c);
                            }}
                            className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                          >
                            + Add Phone
                          </button>
                        )}
                      </div>

                      {/* Email */}
                      <div className="text-muted-foreground flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Mail className="size-3 text-primary shrink-0" /> Email:
                        </span>
                        {cardEmail ? (
                          <span
                            className="text-foreground font-medium truncate max-w-[160px]"
                            title={cardEmail}
                          >
                            {cardEmail}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditCustomer(c);
                            }}
                            className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                          >
                            + Add Email
                          </button>
                        )}
                      </div>

                      {/* Address */}
                      <div className="text-muted-foreground flex items-start justify-between gap-2">
                        <span className="flex items-center gap-1.5 shrink-0">
                          <MapPin className="size-3 text-primary shrink-0" /> Address:
                        </span>
                        {cardAddress ? (
                          <span
                            className="text-foreground font-medium truncate max-w-[160px] text-right"
                            title={cardAddress}
                          >
                            {cardAddress}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditCustomer(c);
                            }}
                            className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                          >
                            + Add Address
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card bottom bar */}
                  <div className="mt-4 pt-2.5 border-t border-border/60 flex items-center justify-between text-[11px] text-primary font-semibold">
                    <span className="hover:underline">Open Customer Dossier →</span>
                    <div className="flex items-center gap-3">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-6 text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"
                        title="Edit Customer Details"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditCustomer(c);
                        }}
                      >
                        <Pencil className="size-3" />
                      </Button>
                      {isSuperAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          title="Delete Customer (Super Admin)"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({
                              type: "Customer Account",
                              id: c.id || c.name,
                              name: c.name,
                              onDelete: async () => {
                                await deleteCustomer(c.id || c.name, currentUser?.name);
                                setDbCustomers((prev) =>
                                  prev.filter((x) => (x.id || x.name) !== (c.id || c.name)),
                                );
                              },
                            });
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {dbCustomers.length === 0 && (
            <p className="p-8 text-center text-muted-foreground">
              No customer records. Create your first customer or convert a qualified lead.
            </p>
          )}
        </>
      ) : module === "inventory" ? (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {dbProducts.length} inventory products tracked
            </span>
            <div className="flex items-center gap-3">
              {hasPermission("inventory.adjust") && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs font-semibold"
                    onClick={() => {
                      if (dbProducts.length > 0 && dbProducts[0]) {
                        setInboundProductId(dbProducts[0].id || "");
                        setInboundReorder(String(dbProducts[0].reorder_level || 20));
                      }
                      setInboundModal(true);
                    }}
                  >
                    <Plus className="size-3.5" />
                    Inbound Stock
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-semibold"
                    onClick={() => setProdModal(true)}
                  >
                    <Plus className="size-3.5" />
                    Add Product
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="module-grid">
            {dbProducts.map((p) => {
              const totalStock = p.on_hand;
              const outbound = outboundOrderedQuantity(dbOrders, p);
              const available = availableFromStock(totalStock, outbound);
              return (
                <article className="module-item" key={p.code}>
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-md bg-accent text-primary">
                      <Package size={20} />
                    </span>
                    <div className="flex items-center gap-3">
                      <span
                        className={`status ${available < p.reorder_level ? "warning" : "success"}`}
                      >
                        {available < p.reorder_level ? "Low stock" : "Healthy"}
                      </span>
                      {hasPermission("inventory.adjust") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs font-semibold hover:border-primary/60 cursor-pointer"
                          title="Edit on-hand stock and reorder level"
                          onClick={() => openEditStock(p)}
                        >
                          <Pencil className="size-3 mr-1" />
                          Edit Stock
                        </Button>
                      )}
                      {isSuperAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          title="Delete Product (Super Admin)"
                          onClick={() => {
                            setDeleteTarget({
                              type: "Product",
                              id: p.id || p.code,
                              name: `${p.name} (${p.code})`,
                              onDelete: async () => {
                                await deleteProduct(p.id || p.code, currentUser?.name);
                                setDbProducts((prev) =>
                                  prev.filter((x) => (x.id || x.code) !== (p.id || p.code)),
                                );
                              },
                            });
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="eyebrow mt-5 !text-[8px]">
                    {p.category} · {p.code}
                  </p>
                  <h2 className="mt-2 text-sm font-bold">{p.name}</h2>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="font-semibold text-foreground">
                      Selling: ₹{p.unit_price}/{p.unit}
                    </span>
                    <span className="text-muted-foreground/60">·</span>
                    <span className="text-muted-foreground">
                      Wholesale: ₹{p.wholesale_price || p.unit_price}/{p.unit}
                    </span>
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border pt-4">
                    {[
                      { n: "Total Stock", v: totalStock },
                      { n: "Outbound / Ordered", v: outbound },
                      { n: "Available Stock", v: available },
                    ].map((x) => (
                      <div key={x.n}>
                        <p className="text-xs font-semibold text-muted-foreground">{x.n}</p>
                        <p className="mt-1 text-lg font-bold">
                          {x.v}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            {p.unit}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                  <progress
                    className="stock-track mt-4 w-full"
                    max={Math.max(totalStock, 1)}
                    value={Math.max(available, 0)}
                    aria-label={`${p.name} available stock`}
                  />
                  <div className="mt-4 pt-3 border-t border-border/70 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground text-[11px]">
                      Min Reorder:{" "}
                      <strong className="text-foreground">
                        {p.reorder_level} {p.unit}
                      </strong>
                    </span>
                    {hasPermission("inventory.adjust") && (
                      <button
                        type="button"
                        onClick={() => openEditStock(p)}
                        className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        title={`Directly edit stock on hand for ${p.name}`}
                      >
                        <Pencil className="size-2.5" /> Edit Stock Count
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {dbProducts.length === 0 && (
            <p className="p-8 text-center text-muted-foreground">
              No products in inventory. Add a product to configure the catalog.
            </p>
          )}
        </>
      ) : module === "accounts" ? (
        <>
          {/* INVOICES & FINANCE DESK KPIS */}
          <div className="kpi-grid">
            <div className="kpi">
              <p className="text-xs text-muted-foreground">Dispatch inbox</p>
              <p className="kpi-value">{companyDeliveries.length}</p>
              <span className="trend">Loads Accounts can see</span>
            </div>
            <div className="kpi">
              <p className="text-xs text-muted-foreground">Ready to invoice</p>
              <p className="kpi-value">{ordersReadyToInvoice.length}</p>
              <span className="trend">Approved orders</span>
            </div>
            <div className="kpi">
              <p className="text-xs text-muted-foreground">Invoiced</p>
              <p className="kpi-value">
                {money(companyInvoices.reduce((s, i) => s + (Number(i.amount) || 0), 0))}
              </p>
              <span className="trend">{companyInvoices.length} documents</span>
            </div>
            <div className="kpi">
              <p className="text-xs text-muted-foreground">Awaiting payment</p>
              <p className="kpi-value">
                {
                  companyInvoices.filter(
                    (i) => i.status !== "Paid" && (Number(i.remaining_amount) || 0) > 0,
                  ).length
                }
              </p>
              <span className="trend">Pending settlement</span>
            </div>
          </div>

          {/* SECTION 1: READY TO INVOICE */}
          {(tab === "All sections" || tab === "Ready to invoice" || tab === "Overview") && (
            <section className="panel mb-6">
              <div className="panel-head flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="panel-title flex items-center gap-2">
                    <Clock className="size-4 text-primary" />
                    Ready to invoice
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Owner approved · manufacturer ready anytime · own vehicle only after truck +
                    driver assigned
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 self-start sm:self-auto">
                  {filteredReadyOrders.length} approved orders
                </span>
              </div>

              {/* Filter bar: Search order, customer, company | All credit */}
              <div className="p-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search order, customer, company"
                    value={readyToInvoiceSearch}
                    onChange={(e) => setReadyToInvoiceSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="w-full sm:w-44">
                  <select
                    value={readyToInvoiceCreditFilter}
                    onChange={(e) => setReadyToInvoiceCreditFilter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                  >
                    <option value="All credit">All credit</option>
                    <option value="Within limit">Within limit</option>
                    <option value="Near limit">Near limit</option>
                    <option value="Limit breached">Limit breached</option>
                  </select>
                </div>
              </div>

              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>COMPANY</th>
                      <th>ORDER</th>
                      <th>CUSTOMER</th>
                      <th>DELIVERY</th>
                      <th>EST. TOTAL</th>
                      <th>CREDIT</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReadyOrders.map((o) => {
                      const comp = companies.find((c) => c.id === o.company_id);
                      const cust = dbCustomers.find(
                        (c) =>
                          c.name?.toLowerCase().trim() === o.customer_name?.toLowerCase().trim() ||
                          c.id === o.customer_id,
                      );
                      const custLimit = Number(cust?.credit_limit) || 500000;
                      const custInvoices = dbInvoices.filter(
                        (i) =>
                          (cust?.name &&
                            i.customer_name?.toLowerCase().trim() ===
                              cust.name.toLowerCase().trim()) ||
                          (cust?.id && i.customer_id === cust.id),
                      );
                      const outstanding = custInvoices.reduce(
                        (s, i) => s + (Number(i.remaining_amount) || 0),
                        0,
                      );
                      let creditBadgeClass = "success";
                      let creditText = "Within limit";
                      if (outstanding > custLimit) {
                        creditBadgeClass = "destructive";
                        creditText = "Limit breached";
                      } else if (custLimit > 0 && outstanding >= custLimit * 0.8) {
                        creditBadgeClass = "warning";
                        creditText = "Near limit";
                      }

                      const del = dbDeliveries.find((d) => d.order_id === o.id);

                      return (
                        <tr key={o.id}>
                          <td>
                            <span className="font-semibold text-xs text-foreground">
                              {comp?.short || o.company_id}
                            </span>
                          </td>
                          <td>
                            <span className="font-mono text-xs font-bold text-foreground">
                              #{o.id}
                            </span>
                          </td>
                          <td>
                            <p className="font-semibold text-xs text-foreground">
                              {o.customer_name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {o.items_summary || "Commercial supplies"}
                            </p>
                          </td>
                          <td>
                            <p className="text-xs font-medium text-foreground">
                              {del?.vehicle_number
                                ? `Vehicle: ${del.vehicle_number}`
                                : o.destination_city || o.delivery_address || "Ready for dispatch"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {del?.driver_name
                                ? `Driver: ${del.driver_name}`
                                : "Confirmed / Approved"}
                            </p>
                          </td>
                          <td className="font-semibold text-xs text-foreground">
                            {money(o.total_amount)}
                          </td>
                          <td>
                            <span className={`status ${creditBadgeClass}`}>{creditText}</span>
                          </td>
                          <td>
                            <Button
                              size="sm"
                              className="h-7 text-xs font-semibold gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
                              onClick={() => handleOpenRaiseInvoiceModal(o)}
                            >
                              <FileCheck2 className="size-3.5" />
                              Raise invoice
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredReadyOrders.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <p className="font-medium text-sm">
                      No orders waiting to bill. Owner must confirm price, then Supervisor must
                      confirm or add the vehicle.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* SECTION 2: DISPATCH INBOX */}
          {(tab === "All sections" || tab === "Dispatch inbox") && (
            <section className="panel mb-6">
              <div className="panel-head flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="panel-title flex items-center gap-2">
                    <Truck className="size-4 text-primary" />
                    Dispatch inbox
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Operational status only — Accounts does not assign vehicles
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {companyDeliveries.length} loads visible
                </span>
              </div>

              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>CUSTOMER</th>
                      <th>PRODUCT</th>
                      <th>QTY</th>
                      <th>STAGE</th>
                      <th>VEHICLE / LR</th>
                      <th>BILLING</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyDeliveries.map((d) => {
                      const relatedOrder = dbOrders.find((o) => o.id === d.order_id);
                      const invoice = dbInvoices.find(
                        (i) =>
                          i.order_id === d.order_id ||
                          i.id === `INV-${d.order_id.replace("ORD-", "")}`,
                      );

                      return (
                        <tr key={d.id}>
                          <td>
                            <p className="font-semibold text-xs text-foreground">
                              {d.customer_name}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              Order #{d.order_id}
                            </p>
                          </td>
                          <td className="text-xs">
                            {relatedOrder?.items_summary || "Commercial B2B Goods"}
                          </td>
                          <td className="text-xs font-semibold">
                            {relatedOrder?.items_count || 1} units
                          </td>
                          <td>
                            <span
                              className={`status ${
                                d.status === "Delivered"
                                  ? "success"
                                  : d.status === "Out for delivery"
                                    ? "info"
                                    : "warning"
                              }`}
                            >
                              {d.status}
                            </span>
                          </td>
                          <td>
                            <p className="text-xs font-medium text-foreground">
                              {d.vehicle_number || "Vehicle Assigned"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {d.lr_number
                                ? `LR: ${d.lr_number}`
                                : d.driver_name
                                  ? `Driver: ${d.driver_name}`
                                  : "—"}
                            </p>
                          </td>
                          <td>
                            {invoice ? (
                              <span className="status success">Invoiced (#{invoice.id})</span>
                            ) : (
                              <span className="status warning">Pending invoice</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {companyDeliveries.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <p className="font-medium text-sm">
                      No dispatch loads yet. They appear here when supervisor / logistics books a
                      movement.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* SECTION 3: ISSUED INVOICES (Mirrored with attached screenshot reference) */}
          {(tab === "All sections" || tab === "Issued invoices") && (
            <section className="panel mb-6">
              <div className="panel-head flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="panel-title flex items-center gap-2">
                    <FileCheck2 className="size-4 text-primary" />
                    Issued invoices
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  Invoice ↔ sales order ↔ dispatch. Filters stay on this company.
                </p>
              </div>

              {/* Filter bar matching reference UI */}
              <div className="p-4 border-b border-border bg-muted/20 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search invoice or customer"
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="w-36">
                  <select
                    value={invoiceStatusFilter}
                    onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-medium cursor-pointer"
                  >
                    <option value="All statuses">All statuses</option>
                    <option value="Unpaid">Unpaid</option>
                    <option value="Partially paid">Partially paid</option>
                    <option value="Paid">Paid</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="w-36">
                  <select
                    value={invoiceDateFilter}
                    onChange={(e) => setInvoiceDateFilter(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-medium cursor-pointer"
                  >
                    <option value="All dates">All dates</option>
                    <option value="Today">Today</option>
                    <option value="This week">This week</option>
                    <option value="This month">This month</option>
                    <option value="Last 30 days">Last 30 days</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={invoiceOverdueOnly}
                    onChange={(e) => setInvoiceOverdueOnly(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary size-3.5 cursor-pointer"
                  />
                  <span className="font-medium">Overdue only</span>
                </label>
              </div>

              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>INVOICE</th>
                      <th>CUSTOMER</th>
                      <th>SO / DISPATCH</th>
                      <th>DATE</th>
                      <th>DUE</th>
                      <th>TOTAL</th>
                      <th>OUTSTANDING</th>
                      <th>STATUS</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIssuedInvoices.map((inv) => {
                      const today = new Date().toISOString().split("T")[0] || "";
                      const isOverdue =
                        inv.due_date && inv.due_date < today && Number(inv.remaining_amount) > 0;
                      const delivery = dbDeliveries.find((d) => d.order_id === inv.order_id);

                      return (
                        <tr key={inv.id}>
                          <td className="font-mono text-xs font-bold text-foreground">#{inv.id}</td>
                          <td>
                            <p className="font-semibold text-xs text-foreground">
                              {inv.customer_name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {companies.find((c) => c.id === inv.company_id)?.short}
                            </p>
                          </td>
                          <td>
                            <p className="text-xs font-mono font-medium text-foreground">
                              {inv.order_id || "—"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {delivery?.vehicle_number
                                ? `Veh: ${delivery.vehicle_number}`
                                : "Dispatch linked"}
                            </p>
                          </td>
                          <td className="text-xs text-muted-foreground">
                            {inv.created_at
                              ? new Date(inv.created_at).toLocaleDateString()
                              : "Today"}
                          </td>
                          <td className="text-xs">
                            <span
                              className={
                                isOverdue
                                  ? "text-destructive font-bold"
                                  : "text-foreground font-medium"
                              }
                            >
                              {inv.due_date || "—"}
                            </span>
                            {isOverdue && (
                              <span className="block text-[9px] text-destructive font-semibold">
                                Overdue
                              </span>
                            )}
                          </td>
                          <td className="font-semibold text-xs text-foreground">
                            {money(inv.amount)}
                          </td>
                          <td className="font-semibold text-xs text-warning">
                            {money(inv.remaining_amount)}
                          </td>
                          <td>
                            <span
                              className={`status ${
                                inv.status === "Paid"
                                  ? "success"
                                  : isOverdue || inv.status === "Overdue"
                                    ? "destructive"
                                    : inv.status === "Partially Paid"
                                      ? "info"
                                      : "warning"
                              }`}
                            >
                              {isOverdue && inv.status !== "Paid" ? "Overdue" : inv.status}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                                title="View Invoice"
                                onClick={() => {
                                  setViewingInvoice(inv);
                                  const ord = dbOrders.find((o) => o.id === inv.order_id);
                                  setViewingOrder(ord || null);
                                  setInvoiceViewModal(true);
                                }}
                              >
                                <Eye className="size-3.5" />
                                <span className="hidden sm:inline">View</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs flex items-center gap-1 font-medium border-border hover:bg-muted cursor-pointer"
                                title="Download GST Tax Invoice"
                                onClick={() => handleDownloadInvoice(inv)}
                              >
                                <Download className="size-3.5 text-primary" />
                                <span>Download</span>
                              </Button>
                              {inv.status !== "Paid" &&
                                Number(inv.remaining_amount) > 0 &&
                                hasPermission("payments.record") && (
                                  <Button
                                    size="sm"
                                    className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                    onClick={() => {
                                      setSelectedInvoiceForPayment(inv);
                                      setPayAmount(String(inv.remaining_amount));
                                      setPaymentModal(true);
                                    }}
                                  >
                                    Record Payment
                                  </Button>
                                )}
                              {isSuperAdmin && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                  title="Delete Invoice (Super Admin)"
                                  onClick={() => {
                                    setDeleteTarget({
                                      type: "Invoice",
                                      id: inv.id,
                                      name: `#${inv.id} (${inv.customer_name})`,
                                      onDelete: async () => {
                                        await deleteInvoice(inv.id, currentUser?.name);
                                        setDbInvoices((prev) =>
                                          prev.filter((x) => x.id !== inv.id),
                                        );
                                      },
                                    });
                                  }}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filteredIssuedInvoices.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <p className="font-medium text-sm">No invoices match these filters.</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* SECTION 4: PAYMENT COLLECTIONS */}
          {(tab === "All sections" || tab === "Payment Collections") && (
            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Payment Collections & Receipts</h2>
                <span className="text-xs text-muted-foreground">
                  {dbPayments.length} recorded payments
                </span>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PAYMENT ID / REF</th>
                      <th>INVOICE #</th>
                      <th>PAYMENT METHOD</th>
                      <th>REFERENCE NUMBER</th>
                      <th>AMOUNT</th>
                      <th>RECORDED AT</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbPayments.map((p, idx) => (
                      <tr key={p.id || idx}>
                        <td className="font-mono text-xs font-semibold">
                          RCP-{String(idx + 1).padStart(4, "0")}
                        </td>
                        <td className="font-semibold">#{p.invoice_id}</td>
                        <td>
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-muted/60 border border-border">
                            <CreditCard className="size-3 text-primary" />
                            {p.payment_method}
                          </span>
                        </td>
                        <td className="text-xs font-mono">{p.reference_number || "—"}</td>
                        <td className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {money(p.amount)}
                        </td>
                        <td className="text-xs text-muted-foreground">
                          {p.created_at ? new Date(p.created_at).toLocaleDateString() : "Today"}
                        </td>
                        <td>
                          <span className="status success">Settled</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {dbPayments.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    <p className="font-medium text-sm">No payment collections recorded yet.</p>
                    <p className="text-xs mt-1">
                      When clients pay against invoices, records will appear in this ledger.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      ) : module === "credit" ? (
        <>
          {/* CREDIT CONTROL WORKSPACE */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                CUSTOMERS
              </div>
              <div className="text-3xl font-extrabold text-foreground mt-2">
                {creditPositions.length}
              </div>
            </div>
            <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                LIMIT ALERTS
              </div>
              <div
                className={`text-3xl font-extrabold mt-2 ${
                  limitAlertsCount > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {limitAlertsCount}
              </div>
            </div>
            <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                NOTES POSTED
              </div>
              <div className="text-3xl font-extrabold text-foreground mt-2">
                {dbCreditNotes.length}
              </div>
            </div>
          </div>

          {/* SECTION 1: CREDIT POSITION */}
          <section className="panel mb-6">
            <div className="panel-head flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h2 className="panel-title text-base font-bold">Credit position</h2>
              </div>
              <span className="text-xs text-muted-foreground">Projected exposure vs limit</span>
            </div>

            <div className="p-4 border-b border-border bg-muted/10 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search customer"
                    value={creditSearch}
                    onChange={(e) => setCreditSearch(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 text-xs rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <select
                  value={creditStatusFilter}
                  onChange={(e) => setCreditStatusFilter(e.target.value)}
                  className="h-9 px-3 text-xs rounded-lg border border-border bg-card font-medium"
                >
                  <option value="all">All statuses</option>
                  <option value="within">Within limit</option>
                  <option value="near">Near limit</option>
                  <option value="breached">Limit breached</option>
                </select>
                <select
                  value={creditBalanceFilter}
                  onChange={(e) => setCreditBalanceFilter(e.target.value)}
                  className="h-9 px-3 text-xs rounded-lg border border-border bg-card font-medium"
                >
                  <option value="all">All balances</option>
                  <option value="outstanding">Has outstanding</option>
                  <option value="zero">Zero balance</option>
                </select>
              </div>
              <div className="text-xs text-muted-foreground font-medium">
                {filteredCreditPositions.length} customer(s)
              </div>
            </div>

            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>CUSTOMER</th>
                    <th>LIMIT</th>
                    <th>DAYS</th>
                    <th>OUTSTANDING</th>
                    <th>OVERDUE</th>
                    <th>HEADROOM</th>
                    <th>STATUS</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCreditPositions.map((p) => (
                    <tr key={p.customer.id || p.customer.name}>
                      <td>
                        <p className="font-bold text-foreground">{p.customer.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {p.customer.contact_person || p.customer.phone || "Active Customer"}
                        </p>
                      </td>
                      <td className="font-semibold">{money(p.limit)}</td>
                      <td>{p.days}d</td>
                      <td
                        className={`font-semibold ${
                          p.outstanding > 0 ? "text-amber-600 dark:text-amber-400" : ""
                        }`}
                      >
                        {money(p.outstanding)}
                      </td>
                      <td
                        className={`font-semibold ${
                          p.overdue > 0 ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {money(p.overdue)}
                      </td>
                      <td className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {money(p.headroom)}
                      </td>
                      <td>
                        <span
                          className={`status ${
                            p.status === "Limit breached"
                              ? "danger"
                              : p.status === "Near limit"
                                ? "warning"
                                : "success"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs font-semibold cursor-pointer"
                          onClick={() => {
                            setSelectedCreditCustomer(p.customer);
                            setEditCreditLimit(String(p.limit));
                            setEditCreditDays(String(p.days));
                            setEditCreditModal(true);
                          }}
                        >
                          Edit Limit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredCreditPositions.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm font-medium">No credit positions yet.</p>
                </div>
              )}
            </div>
          </section>

          {/* SECTION 2: CREDIT / DEBIT NOTE */}
          <section className="panel mb-6">
            <div className="panel-head flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h2 className="panel-title text-base font-bold">Credit / debit note</h2>
              </div>
              <span className="text-xs text-muted-foreground">
                Posted notes adjust outstanding. They do not change warehouse stock.
              </span>
            </div>

            <form
              onSubmit={handlePostCreditNote}
              className="p-4 border-b border-border bg-muted/10"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Invoice
                  </label>
                  <select
                    value={noteInvoiceId}
                    onChange={(e) => setNoteInvoiceId(e.target.value)}
                    className="w-full h-9 px-2 text-xs rounded-lg border border-border bg-card"
                  >
                    <option value="">Select</option>
                    {dbInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        #{inv.id} &bull; {inv.customer_name} ({money(inv.remaining_amount)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Type
                  </label>
                  <select
                    value={noteType}
                    onChange={(e) => setNoteType(e.target.value as "Credit note" | "Debit note")}
                    className="w-full h-9 px-2 text-xs rounded-lg border border-border bg-card font-medium"
                  >
                    <option value="Credit note">Credit note</option>
                    <option value="Debit note">Debit note</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Reason
                  </label>
                  <select
                    value={noteReason}
                    onChange={(e) => setNoteReason(e.target.value)}
                    className="w-full h-9 px-2 text-xs rounded-lg border border-border bg-card font-medium"
                  >
                    <option value="Returned goods">Returned goods</option>
                    <option value="Pricing discrepancy">Pricing discrepancy</option>
                    <option value="Quality rebate">Quality rebate</option>
                    <option value="Damaged in transit">Damaged in transit</option>
                    <option value="Correction">Correction</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="₹ Amount"
                    value={noteAmount}
                    onChange={(e) => setNoteAmount(e.target.value)}
                    required
                    className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                  />
                </div>

                <div>
                  <Button
                    type="submit"
                    disabled={postingNote}
                    className="w-full h-9 text-xs font-bold bg-[#1e4620] hover:bg-[#163618] text-white cursor-pointer"
                  >
                    {postingNote ? "Posting..." : "Post note"}
                  </Button>
                </div>
              </div>
            </form>

            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>TYPE</th>
                    <th>INVOICE</th>
                    <th>CUSTOMER</th>
                    <th>AMOUNT</th>
                    <th>REASON</th>
                    <th>STATUS</th>
                    <th>DATE</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {dbCreditNotes.map((note) => (
                    <tr key={note.id}>
                      <td>
                        <span
                          className={`status ${note.type === "Credit note" ? "success" : "brand"}`}
                        >
                          {note.type}
                        </span>
                      </td>
                      <td className="font-mono text-xs font-semibold">
                        {note.invoice_id ? `#${note.invoice_id}` : "Direct"}
                      </td>
                      <td className="font-semibold">{note.customer_name}</td>
                      <td className="font-bold text-foreground">{money(note.amount)}</td>
                      <td className="text-xs text-muted-foreground">{note.reason}</td>
                      <td>
                        <span className="status success">{note.status}</span>
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {note.created_at ? note.created_at.split("T")[0] : "Today"}
                      </td>
                      <td>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                          title="Delete note (Super Admin)"
                          onClick={async () => {
                            await deleteCreditNote(note.id, currentUser?.name);
                            setDbCreditNotes((prev) => prev.filter((n) => n.id !== note.id));
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {dbCreditNotes.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="text-sm font-medium">No credit or debit notes yet.</p>
                </div>
              )}
            </div>
          </section>
        </>
      ) : module === "analytics" ? (
        <>
          {/* EXECUTIVE BUSINESS INTELLIGENCE CONSOLE */}
          <div className="kpi-grid">
            {[
              {
                n: "Total ERP Gross",
                v: money(dbOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0)),
                sub: currentUser?.role === "logistics" ? "Assigned to you" : "Across all companies",
              },
              { n: "Realized Collections", v: money(totalCollectedRevenue), sub: "Cash collected" },
              {
                n: "Active Customer Accounts",
                v: String(dbCustomers.length),
                sub: "Verified CRM clients",
              },
              {
                n: "Lead Win Rate",
                v:
                  dbLeads.length > 0
                    ? `${Math.round((dbLeads.filter((l) => l.stage === "Converted").length / dbLeads.length) * 100)}%`
                    : "0%",
                sub: "Conversion to customer",
              },
            ].map((k) => (
              <div className="kpi" key={k.n}>
                <p className="text-xs text-muted-foreground">{k.n}</p>
                <p className="kpi-value">{k.v}</p>
                <span className="trend">{k.sub}</span>
              </div>
            ))}
          </div>

          {tab === "Revenue Trends" || tab === "Overview" ? (
            <div className="space-y-6">
              <section className="panel">
                <div className="panel-head flex items-center justify-between">
                  <div>
                    <h2 className="panel-title">Revenue Trajectory & Sales Forecast</h2>
                    <span className="text-xs text-muted-foreground">
                      Monthly aggregate realized revenue
                    </span>
                  </div>
                </div>
                <RevenueChart totalRevenue={totalCollectedRevenue} />
              </section>

              {/* Bar Graph: Multi-Company Comparison */}
              <CompanyComparisonBarChart
                orders={dbOrders}
                invoices={dbInvoices}
                customers={dbCustomers}
              />

              {/* Pie Charts: Revenue Share & Order Lifecycle */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <CompanyRevenuePieChart orders={dbOrders} invoices={dbInvoices} />
                <OrderStatusPieChart orders={dbOrders} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-border bg-card">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Average Deal Size
                  </p>
                  <p className="text-xl font-bold mt-1 text-foreground">
                    {dbOrders.length > 0
                      ? money(
                          Math.round(
                            dbOrders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0) /
                              dbOrders.length,
                          ),
                        )
                      : "₹0"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Per approved order</p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Logistics Fulfillment
                  </p>
                  <p className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                    {dbOrders.length > 0
                      ? `${Math.round((dbOrders.filter((o) => ["Delivered", "Out for delivery"].includes(o.status)).length / dbOrders.length) * 100)}%`
                      : "100%"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Order fulfillment rate</p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Field Visit Traction
                  </p>
                  <p className="text-xl font-bold mt-1 text-foreground">
                    {visibleFieldVisits.length}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Total customer meetings
                  </p>
                </div>
              </div>
            </div>
          ) : tab === "Company Comparison" ? (
            <div className="space-y-6">
              {/* Bar Graph & Visual Comparison */}
              <CompanyComparisonBarChart
                orders={dbOrders}
                invoices={dbInvoices}
                customers={dbCustomers}
              />

              {/* Pie Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <CompanyRevenuePieChart orders={dbOrders} invoices={dbInvoices} />
                <OrderStatusPieChart orders={dbOrders} />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Subsidiary Corporate Cards</h3>
                  <span className="text-xs text-muted-foreground">4 entities tracked</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {companies.map((c) => {
                    const companyOrders = dbOrders.filter((o) => o.company_id === c.id);
                    const companyRev = companyOrders.reduce(
                      (s, o) => s + (Number(o.total_amount) || 0),
                      0,
                    );
                    const companyCusts = dbCustomers.filter((cu) => cu.company_id === c.id);
                    return (
                      <div
                        key={c.id}
                        className="p-5 rounded-xl border border-border bg-card shadow-sm space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CompanyLogo id={c.id} />
                            <div>
                              <h4 className="font-bold text-sm text-foreground">{c.name}</h4>
                              <p className="text-xs text-muted-foreground">
                                {c.short} · GST {c.gstin}
                              </p>
                            </div>
                          </div>
                          <span className="status success">Active</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/60 text-center">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">
                              Orders
                            </p>
                            <p className="text-base font-extrabold text-foreground mt-0.5">
                              {companyOrders.length}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">
                              Gross Sales
                            </p>
                            <p className="text-base font-extrabold text-foreground mt-0.5">
                              {money(companyRev)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">
                              Customers
                            </p>
                            <p className="text-base font-extrabold text-foreground mt-0.5">
                              {companyCusts.length}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : tab === "Product Performance" ? (
            <div className="space-y-6">
              <ProductCategoryCharts products={dbProducts} />
              <div className="panel">
                <div className="panel-head flex items-center justify-between">
                  <div>
                    <h3 className="panel-title">Product Catalog & Inventory Valuation</h3>
                    <span className="text-xs text-muted-foreground">
                      {dbProducts.length} registered products
                    </span>
                  </div>
                </div>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>PRODUCT / SKU</th>
                        <th>CATEGORY</th>
                        <th>SELLING PRICE</th>
                        <th>WHOLESALE PRICE</th>
                        <th>ON HAND STOCK</th>
                        <th>EST. INVENTORY VALUE</th>
                        <th>STOCK STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dbProducts.map((p) => {
                        const value = (p.on_hand || 0) * (p.unit_price || 0);
                        return (
                          <tr key={p.code}>
                            <td>
                              <p className="font-semibold">{p.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {p.code}
                              </p>
                            </td>
                            <td>
                              <span className="text-xs px-2 py-0.5 rounded bg-muted/60">
                                {p.category}
                              </span>
                            </td>
                            <td className="font-semibold text-xs">
                              {money(p.unit_price)} / {p.unit}
                            </td>
                            <td className="font-semibold text-xs text-muted-foreground">
                              {money(p.wholesale_price || p.unit_price)} / {p.unit}
                            </td>
                            <td className="font-mono text-xs">
                              {p.on_hand} {p.unit}
                            </td>
                            <td className="font-semibold text-xs text-foreground">
                              {money(value)}
                            </td>
                            <td>
                              <span
                                className={`status ${p.on_hand <= (p.reorder_level || 0) ? "warning" : "success"}`}
                              >
                                {p.on_hand <= (p.reorder_level || 0) ? "Low Stock" : "Healthy"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {dbProducts.length === 0 && (
                    <p className="p-8 text-center text-muted-foreground">
                      No products in inventory.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Conversion Funnel */
            <div className="space-y-6">
              <ConversionFunnelBarChart
                leads={dbLeads}
                visits={visibleFieldVisits}
                orders={dbOrders}
                invoices={dbInvoices}
              />
              <div className="panel p-6 space-y-6">
                <div>
                  <h3 className="panel-title">Commercial Conversion Pipeline Funnel</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    End-to-end milestone progression from prospect inquiry to settled payment
                  </p>
                </div>
                <div className="space-y-3">
                  {[
                    {
                      stage: "1. Prospect Inquiries (Leads)",
                      count: dbLeads.length,
                      color: "bg-blue-500",
                      desc: "Leads captured in CRM",
                    },
                    {
                      stage: "2. Field Visits Conducted",
                      count: visibleFieldVisits.length,
                      color: "bg-indigo-500",
                      desc: "On-site customer visits",
                    },
                    {
                      stage: "3. Sales Orders Booked",
                      count: dbOrders.length,
                      color: "bg-purple-500",
                      desc: "Commercial orders registered",
                    },
                    {
                      stage: "4. Logistics Dispatched & Delivered",
                      count: dbOrders.filter((o) =>
                        ["Ready to dispatch", "Out for delivery", "Delivered"].includes(o.status),
                      ).length,
                      color: "bg-amber-500",
                      desc: "Delivered to customer",
                    },
                    {
                      stage: "5. Invoices Settled (Paid)",
                      count: dbInvoices.filter((i) => i.status === "Paid").length,
                      color: "bg-emerald-500",
                      desc: "Payment received & reconciled",
                    },
                  ].map((f) => (
                    <div
                      key={f.stage}
                      className="p-4 rounded-xl border border-border bg-card/60 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`size-3 rounded-full ${f.color}`} />
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{f.stage}</h4>
                          <p className="text-[11px] text-muted-foreground">{f.desc}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-black text-foreground">{f.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      ) : module === "administration" ? (
        !isSuperAdmin ? (
          <TeamLogins />
        ) : (
        <>
          <p className="text-xs text-muted-foreground mb-4">
            Owner adds companies, login IDs with the features each person needs, and fleet trucks.
            Sales and supervisors allot a vehicle, then a driver, on the Order desk.
          </p>

          <div className="kpi-grid mb-6">
            <div className="kpi">
              <p className="text-xs text-muted-foreground uppercase font-semibold">COMPANIES</p>
              <p className="kpi-value">{companies.length}</p>
              <span className="trend">Fixed 4 entities</span>
            </div>
            <div className="kpi">
              <p className="text-xs text-muted-foreground uppercase font-semibold">ACTIVE USERS</p>
              <p className="kpi-value">7</p>
              <span className="trend">RBAC authenticated</span>
            </div>
            <div className="kpi">
              <p className="text-xs text-muted-foreground uppercase font-semibold">FLEET TRUCKS</p>
              <p className="kpi-value">{dbVehicles.length}</p>
              <span className="trend">Allotted on Order desk</span>
            </div>
            <div className="kpi">
              <p className="text-xs text-muted-foreground uppercase font-semibold">AUDIT ENTRIES</p>
              <p className="kpi-value">—</p>
              <span className="trend">PostgreSQL immutable</span>
            </div>
          </div>

          {tab === "Companies" || tab === "Overview" ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">Companies / firms</h3>
                <span className="text-xs text-muted-foreground">{companies.length} total</span>
              </div>
              <div className="space-y-3">
                {companies.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border bg-card shadow-sm hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <CompanyLogo id={c.id} />
                      <div>
                        <h4 className="text-sm font-bold text-foreground">{c.name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {c.short} · GST {c.gstin} · {c.invPrefix}
                        </p>
                      </div>
                    </div>
                    <span className="status success">Active</span>
                  </div>
                ))}
              </div>
            </div>
          ) : tab === "Fleet" ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Fleet Management & Vehicle Availability
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Real-time status tracking across company godowns. Vehicles currently Dispatched
                    / On Delivery cannot be assigned to new orders.
                  </p>
                </div>
                {hasPermission("admin.manage") && (
                  <Button
                    size="sm"
                    onClick={openAddVehicleModal}
                    className="h-9 gap-1.5 text-xs font-bold cursor-pointer"
                  >
                    <Plus className="size-4" /> Add Vehicle
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dbVehicles.map((truck) => {
                  const isDispatched = truck.status === "Dispatched / On Delivery";
                  const isAvailable = truck.status === "Available / At Godown";
                  const isReturned = truck.status === "Returned to Godown";
                  const isBooked = truck.status === "Assigned / Booked";

                  let badgeStyle = "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
                  if (isDispatched)
                    badgeStyle = "bg-amber-500/15 text-amber-600 border-amber-500/30";
                  else if (isReturned)
                    badgeStyle = "bg-blue-500/15 text-blue-600 border-blue-500/30";
                  else if (isBooked)
                    badgeStyle = "bg-purple-500/15 text-purple-600 border-purple-500/30";

                  return (
                    <div
                      key={truck.id}
                      className="p-4 rounded-xl border border-border bg-card shadow-xs space-y-3 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-extrabold text-foreground">
                            {truck.plate_number}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle}`}
                          >
                            {truck.status}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-foreground mt-1.5">
                          {truck.make_model}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Capacity: {truck.capacity || "Commercial"} · Entity:{" "}
                          {companies.find((c) => c.id === truck.company_id)?.short || "All"}
                        </p>
                        {(truck.assigned_driver_name || truck.driver_name) && (
                          <div className="mt-2.5 pt-2 border-t border-border/60 text-xs">
                            <span className="text-muted-foreground">Default Driver: </span>
                            <span className="font-semibold text-foreground">
                              {truck.assigned_driver_name || truck.driver_name}
                              {truck.assigned_driver_phone || truck.driver_phone
                                ? ` · ${truck.assigned_driver_phone || truck.driver_phone}`
                                : ""}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-border flex items-center justify-between gap-2 flex-wrap">
                        {(isDispatched || isBooked) &&
                          (currentUser?.role === "supervisor" ||
                            currentUser?.role === "logistics" ||
                            isSuperAdmin) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] font-semibold text-primary hover:bg-primary/10 border-primary/30 cursor-pointer"
                              onClick={() => handleMarkVehicleReturned(truck.plate_number)}
                            >
                              Mark Returned / Available
                            </Button>
                          )}
                        {hasPermission("admin.manage") && (
                          <div className="flex items-center gap-1.5 ml-auto">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                              onClick={() => openEditVehicleModal(truck)}
                              title="Edit Vehicle"
                            >
                              <Pencil className="size-3 mr-1" /> Edit
                            </Button>
                            {isSuperAdmin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                                onClick={() => handleDeleteVehicle(truck)}
                                title="Delete Vehicle (Super Admin)"
                              >
                                <Trash2 className="size-3 mr-1" /> Delete
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {dbVehicles.length === 0 && (
                <div className="p-8 text-center text-muted-foreground rounded-xl border border-dashed border-border">
                  <Truck className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="font-semibold text-sm">No vehicles in fleet yet.</p>
                  <p className="text-xs mt-1">
                    Super Admin can add vehicles using the button above.
                  </p>
                </div>
              )}
            </div>
          ) : tab === "Users" ? (
            <TeamLogins />
          ) : tab === "Roles" ? (
            <TeamLogins />
          ) : (
            <div className="p-6 rounded-xl border border-border bg-card">
              <h4 className="text-sm font-bold mb-2">Audit Trail</h4>
              <p className="text-xs text-muted-foreground mb-4">
                Tamper-evident audit logs recorded in PostgreSQL db_audit_logs.
              </p>
              <div className="space-y-2">
                <div className="text-xs p-3 rounded bg-muted/40 border border-border flex justify-between">
                  <span>
                    System security configuration initialized for all 4 company workspaces
                  </span>
                  <span className="text-muted-foreground">Active</span>
                </div>
                <div className="text-xs p-3 rounded bg-muted/40 border border-border flex justify-between">
                  <span>Multi-tenant row-level access validated</span>
                  <span className="text-muted-foreground">Active</span>
                </div>
              </div>
            </div>
          )}
          <p className="mt-6 text-xs text-muted-foreground">
            Each login ID opens only the features you tick when you create it.
          </p>
        </>
        )
      ) : module === "leads" ? (
        <>
          {/* TOP KPI METRICS RIBBON */}
          <div className="leads-kpi-grid">
            <div className="leads-kpi-card">
              <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Active Deals</span>
                <Users className="size-4 text-primary" />
              </div>
              <p className="text-2xl font-black text-foreground">{dbLeads.length}</p>
              <span className="text-[11px] font-medium text-muted-foreground mt-0.5 block">
                Commercial prospects
              </span>
            </div>

            <div className="leads-kpi-card">
              <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  Pipeline Value
                </span>
                <TrendingUp className="size-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {money(dbLeads.reduce((sum, l) => sum + (Number(l.estimated_value) || 0), 0))}
              </p>
              <span className="text-[11px] font-medium text-muted-foreground mt-0.5 block">
                Estimated potential
              </span>
            </div>

            <div className="leads-kpi-card">
              <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">
                  In Qualification
                </span>
                <Target className="size-4 text-amber-500" />
              </div>
              <p className="text-2xl font-black text-foreground">
                {dbLeads.filter((l) => l.stage === "Qualified" || l.stage === "Follow-up").length}
              </p>
              <span className="text-[11px] font-medium text-muted-foreground mt-0.5 block">
                Qualified & follow-ups
              </span>
            </div>

            <div className="leads-kpi-card">
              <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider">Converted</span>
                <UserCheck className="size-4 text-primary" />
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-foreground">
                  {dbLeads.filter((l) => l.stage === "Converted").length}
                </p>
                <span className="text-xs font-bold text-primary">
                  (
                  {dbLeads.length > 0
                    ? Math.round(
                        (dbLeads.filter((l) => l.stage === "Converted").length / dbLeads.length) *
                          100,
                      )
                    : 0}
                  %)
                </span>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground mt-0.5 block">
                Active customers
              </span>
            </div>
          </div>

          {/* SEARCH, FILTER & ACTION CONTROLS */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border border-border bg-card shadow-2xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search leads by name, contact, phone, city..."
                  value={leadSearchQuery}
                  onChange={(e) => setLeadSearchQuery(e.target.value)}
                  className="w-full text-xs font-medium pl-9 pr-8 h-9 rounded-lg border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary"
                />
                {leadSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setLeadSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="size-3.5 text-muted-foreground" />
                <select
                  value={leadPriorityFilter}
                  onChange={(e) => setLeadPriorityFilter(e.target.value)}
                  className="text-xs font-medium h-9 px-2.5 rounded-lg border border-border bg-background"
                >
                  <option value="All">All Priorities</option>
                  <option value="High">High Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="Low">Low Priority</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-xs text-muted-foreground font-medium">
                {
                  dbLeads.filter((l) => {
                    const matchesSearch =
                      !leadSearchQuery ||
                      `${l.business_name} ${l.contact_person} ${l.phone} ${l.city} ${l.product_interest} ${l.requirement || ""}`
                        .toLowerCase()
                        .includes(leadSearchQuery.toLowerCase());
                    const matchesPriority =
                      leadPriorityFilter === "All" || l.priority === leadPriorityFilter;
                    return matchesSearch && matchesPriority;
                  }).length
                }{" "}
                leads found
              </span>
              <Button
                size="sm"
                className="h-9 px-4 text-xs font-semibold shrink-0"
                onClick={() => setLeadModal(true)}
              >
                <Plus className="size-4 mr-1" />
                Add lead
              </Button>
            </div>
          </div>

          {/* EMPTY LEADS PROMPT BANNER */}
          {dbLeads.length === 0 && (
            <div className="p-8 mb-6 text-center rounded-2xl border border-dashed border-border bg-card/60 space-y-3">
              <Users className="size-10 mx-auto text-muted-foreground opacity-50" />
              <div>
                <h3 className="font-bold text-sm text-foreground">No Leads in Pipeline</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Start by capturing prospective customer inquiries and commercial demands.
                </p>
              </div>
              <Button size="sm" onClick={() => setLeadModal(true)} className="h-9 px-4 text-xs">
                <Plus className="size-4 mr-1.5" />
                Add Your First Lead
              </Button>
            </div>
          )}

          {/* MOBILE STAGE FILTER PILLS (Strictly for Mobile screens) */}
          <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
            {["All", "New", "Qualified", "Follow-up", "Converted"].map((stage) => {
              const count =
                stage === "All" ? dbLeads.length : dbLeads.filter((l) => l.stage === stage).length;
              const isSelected = leadMobileStageFilter === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setLeadMobileStageFilter(stage)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {stage} ({count})
                </button>
              );
            })}
          </div>

          {/* PIPELINE KANBAN VIEW */}
          {tab === "Pipeline" || tab === "Overview" ? (
            <div className="leads-pipeline-grid">
              {["New", "Qualified", "Follow-up", "Converted"]
                .filter(
                  (stage) => leadMobileStageFilter === "All" || leadMobileStageFilter === stage,
                )
                .map((stage) => {
                  const stageLeads = dbLeads.filter((l) => {
                    const matchesStage = l.stage === stage;
                    const matchesSearch =
                      !leadSearchQuery ||
                      `${l.business_name} ${l.contact_person} ${l.phone} ${l.city} ${l.product_interest} ${l.requirement || ""}`
                        .toLowerCase()
                        .includes(leadSearchQuery.toLowerCase());
                    const matchesPriority =
                      leadPriorityFilter === "All" || l.priority === leadPriorityFilter;
                    return matchesStage && matchesSearch && matchesPriority;
                  });

                  const stageTotalVal = stageLeads.reduce(
                    (sum, l) => sum + (Number(l.estimated_value) || 0),
                    0,
                  );

                  const stageTone =
                    stage === "New"
                      ? "tone-new"
                      : stage === "Qualified"
                        ? "tone-qualified"
                        : stage === "Follow-up"
                          ? "tone-followup"
                          : "tone-converted";

                  return (
                    <div key={stage} className={`lead-column ${stageTone}`}>
                      <div
                        className={`lead-column-header ${
                          leadMobileStageFilter === stage ? "is-active" : ""
                        }`}
                        onClick={() =>
                          setLeadMobileStageFilter(leadMobileStageFilter === stage ? "All" : stage)
                        }
                        title={`Click to filter by ${stage}`}
                      >
                        <div className="lead-column-title">
                          <span className="lead-column-dot" />
                          <h3>{stage}</h3>
                          <span className="lead-column-count">{stageLeads.length}</span>
                        </div>
                        <span className="lead-column-value">{money(stageTotalVal)}</span>
                      </div>

                      <div className="lead-column-body">
                        {stageLeads.map((l) => {
                          const priorityClass =
                            l.priority === "High" || l.priority === "Urgent"
                              ? "lead-priority-high"
                              : l.priority === "Medium"
                                ? "lead-priority-medium"
                                : "lead-priority-low";

                          return (
                            <div
                              key={l.id || l.business_name}
                              className="lead-card cursor-pointer hover:border-primary/50 hover:shadow-md transition-all space-y-2.5"
                              onClick={() => setSelectedLeadDetails(l)}
                              title="Click to view full lead details & change stage"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/60 px-2 py-0.5 rounded-md">
                                  <Building2 className="size-3 text-primary" />
                                  {companies.find((c) => c.id === l.company_id)?.short || "Firm"}
                                </span>
                                <div
                                  className="flex items-center gap-1.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <select
                                    value={l.stage}
                                    onChange={(e) =>
                                      handleUpdateLeadStage(
                                        l.id!,
                                        e.target.value as
                                          "New" | "Qualified" | "Follow-up" | "Converted",
                                      )
                                    }
                                    className="text-[10px] font-bold py-0.5 px-1.5 rounded border border-border bg-background cursor-pointer hover:border-primary text-foreground focus:ring-1 focus:ring-primary"
                                    title="Change stage"
                                  >
                                    <option value="New">New</option>
                                    <option value="Qualified">Qualified</option>
                                    <option value="Follow-up">Follow-up</option>
                                    <option value="Converted">Converted</option>
                                  </select>
                                  <span className={`lead-priority-badge ${priorityClass}`}>
                                    {l.priority || "Medium"}
                                  </span>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm font-extrabold text-foreground tracking-tight leading-snug hover:text-primary transition-colors">
                                  {l.business_name}
                                </h4>
                                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                                  {l.contact_person}
                                </p>
                              </div>

                              {/* Click-to-Call & WhatsApp Quick Action Bar */}
                              {l.phone && (
                                <div
                                  className="flex items-center gap-2 pt-0.5"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <a
                                    href={`tel:${l.phone}`}
                                    className="lead-contact-btn flex-1"
                                    title={`Call ${l.contact_person}`}
                                  >
                                    <Phone className="size-3 text-primary" />
                                    <span>Call ({l.phone.slice(-4)})</span>
                                  </a>
                                  <a
                                    href={`https://wa.me/${l.phone.replace(/[^0-9]/g, "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="lead-contact-btn flex-1"
                                    title="Open WhatsApp chat"
                                  >
                                    <MessageSquare className="size-3 text-emerald-600 dark:text-emerald-400" />
                                    <span>WhatsApp</span>
                                  </a>
                                </div>
                              )}

                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {l.city && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded border border-border/60">
                                    <MapPin className="size-2.5 text-primary" /> {l.city}
                                  </span>
                                )}
                                {l.product_interest && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-foreground bg-accent/60 px-2 py-0.5 rounded border border-border/60">
                                    <Package className="size-2.5 text-primary" />{" "}
                                    {l.product_interest}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between border-t border-border pt-2 mt-1">
                                <div>
                                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                                    Deal Value
                                  </span>
                                  <span className="text-sm font-black text-foreground">
                                    {money(l.estimated_value || 0)}
                                  </span>
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                  {l.source === "Referral" && l.referred_by
                                    ? `Referral · ${l.referred_by}`
                                    : l.source || "WhatsApp"}
                                </span>
                              </div>

                              {l.requirement && (
                                <p className="text-[11px] text-muted-foreground line-clamp-2 bg-muted/30 p-2 rounded-lg border border-border/50 italic leading-relaxed">
                                  "{l.requirement}"
                                </p>
                              )}

                              {/* Interactive Stage Advancement Buttons */}
                              <div
                                className="flex items-center gap-3 pt-1 border-t border-border/60"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {l.stage === "New" && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateLeadStage(l.id!, "Qualified")}
                                    className="flex-1 py-1 px-2 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                                    title="Move to Qualified column"
                                  >
                                    <span>Move to Qualified</span>
                                    <ArrowRight className="size-3" />
                                  </button>
                                )}
                                {l.stage === "Qualified" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateLeadStage(l.id!, "New")}
                                      className="py-1 px-2 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground border border-border text-[10px] font-semibold"
                                      title="Move back to New"
                                    >
                                      ← New
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateLeadStage(l.id!, "Follow-up")}
                                      className="flex-1 py-1 px-2 rounded-md bg-primary/10 hover:bg-primary/15 text-primary border border-primary/25 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
                                      title="Move to Follow-up column"
                                    >
                                      <span>Move to Follow-up</span>
                                      <ArrowRight className="size-3" />
                                    </button>
                                  </>
                                )}
                                {l.stage === "Follow-up" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateLeadStage(l.id!, "Qualified")}
                                      className="py-1 px-2 rounded-md bg-muted hover:bg-muted/80 text-muted-foreground border border-border text-[10px] font-semibold"
                                      title="Move back to Qualified"
                                    >
                                      ← Qualified
                                    </button>
                                    {hasPermission("leads.convert") && (
                                      <button
                                        type="button"
                                        onClick={() => handleConvertLead(l)}
                                        className="flex-1 py-1 px-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center gap-1 shadow-xs transition-colors"
                                      >
                                        <UserCheck className="size-3.5" />
                                        <span>Convert Customer</span>
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>

                              {l.stage !== "Converted" ? (
                                hasPermission("leads.convert") && (
                                  <button
                                    type="button"
                                    className="btn-convert-lead mt-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleConvertLead(l);
                                    }}
                                  >
                                    <UserCheck className="size-3.5" />
                                    <span>Convert to Customer</span>
                                  </button>
                                )
                              ) : (
                                <div className="mt-1 flex items-center justify-between gap-1.5 py-1.5 px-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                                  <div className="flex items-center gap-1.5">
                                    <Check className="size-3.5" />
                                    <span>Active Customer</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate({ to: "/customers" });
                                    }}
                                    className="text-[10px] font-bold underline hover:opacity-80 cursor-pointer"
                                  >
                                    View →
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {stageLeads.length === 0 && (
                          <button
                            type="button"
                            onClick={() => setLeadModal(true)}
                            className="lead-empty"
                            title={`Add a lead in ${stage}`}
                          >
                            <Plus className="size-4" />
                            <span>Add {stage.toLowerCase()} lead</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            /* LIST VIEW */
            <div className="panel overflow-hidden">
              <div className="panel-head flex items-center justify-between">
                <div>
                  <h3 className="panel-title">Prospect Directory</h3>
                  <span className="text-xs text-muted-foreground">
                    Comprehensive commercial prospect listing
                  </span>
                </div>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Business</th>
                      <th>Company</th>
                      <th>Contact Person</th>
                      <th>Phone</th>
                      <th>City</th>
                      <th>Product Interest</th>
                      <th>Est. Value</th>
                      <th>Stage</th>
                      <th>Priority</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dbLeads
                      .filter((l) => {
                        const matchesSearch =
                          !leadSearchQuery ||
                          `${l.business_name} ${l.contact_person} ${l.phone} ${l.city} ${l.product_interest} ${l.requirement || ""}`
                            .toLowerCase()
                            .includes(leadSearchQuery.toLowerCase());
                        const matchesPriority =
                          leadPriorityFilter === "All" || l.priority === leadPriorityFilter;
                        return matchesSearch && matchesPriority;
                      })
                      .map((l) => (
                        <tr
                          key={l.id || l.business_name}
                          onClick={() => setSelectedLeadDetails(l)}
                          className="cursor-pointer hover:bg-muted/40 transition-colors group"
                        >
                          <td className="font-bold text-foreground group-hover:text-primary transition-colors">
                            {l.business_name}
                          </td>
                          <td>
                            <span className="text-xs text-muted-foreground">
                              {companies.find((c) => c.id === l.company_id)?.short}
                            </span>
                          </td>
                          <td className="text-xs">{l.contact_person}</td>
                          <td className="text-xs font-mono">
                            {l.phone ? (
                              <a
                                href={`tel:${l.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <Phone className="size-3" /> {l.phone}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="text-xs">{l.city || "—"}</td>
                          <td className="text-xs font-medium">{l.product_interest || "General"}</td>
                          <td className="text-xs font-bold text-foreground">
                            {money(l.estimated_value || 0)}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <select
                              value={l.stage}
                              onChange={(e) =>
                                handleUpdateLeadStage(
                                  l.id!,
                                  e.target.value as "New" | "Qualified" | "Follow-up" | "Converted",
                                )
                              }
                              className="text-xs font-semibold py-1 px-2 rounded-md border border-border bg-background cursor-pointer hover:border-primary text-foreground transition-colors"
                            >
                              <option value="New">New</option>
                              <option value="Qualified">Qualified</option>
                              <option value="Follow-up">Follow-up</option>
                              <option value="Converted">Converted</option>
                            </select>
                          </td>
                          <td>
                            <span
                              className={`lead-priority-badge ${
                                l.priority === "High"
                                  ? "lead-priority-high"
                                  : l.priority === "Medium"
                                    ? "lead-priority-medium"
                                    : "lead-priority-low"
                              }`}
                            >
                              {l.priority}
                            </span>
                          </td>
                          <td className="text-right" onClick={(e) => e.stopPropagation()}>
                            {l.stage !== "Converted" && hasPermission("leads.convert") ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs font-semibold cursor-pointer"
                                onClick={() => handleConvertLead(l)}
                              >
                                Convert
                              </Button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => navigate({ to: "/customers" })}
                                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1 justify-end ml-auto"
                                title="View customer record"
                              >
                                <Check className="size-3" />
                                <span>Customer →</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : module === "logistics" ? (
        <>
          {(() => {
            const isDriver = currentUser?.role === "logistics";
            const canAssignVehicle =
              !isDriver &&
              (hasPermission("logistics.dispatch") ||
                hasPermission("orders.edit") ||
                isSuperAdmin ||
                currentUser?.role === "supervisor");

            // Driver sees ONLY trips explicitly assigned to them
            const driverTrips = isDriver
              ? dbDeliveries.filter((d) =>
                  d.driver_name
                    .toLowerCase()
                    .includes((currentUser?.name || "Mahesh").toLowerCase()),
                )
              : dbDeliveries;

            // Orders awaiting vehicle & driver assignment from Order Desk (must have invoice generated)
            const ordersReadyForAssignment = dbOrders.filter(
              (o) =>
                o.status === "Ready to dispatch" && !dbDeliveries.some((d) => d.order_id === o.id),
            );

            return (
              <div className="space-y-6">
                {/* Header & Sub-Tabs */}
                <div className="flex flex-wrap justify-between items-center gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {isDriver ? "Driver Delivery Portal" : "Logistics & Fleet Operations"}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isDriver
                        ? `Logged in as Driver: ${currentUser?.name || "Mahesh Patel"} — Showing your assigned trips only.`
                        : "Centralized vehicle assignment, delivery tracking, and POD verification."}
                    </p>
                  </div>

                  {!isDriver && (
                    <div className="logistics-switch flex items-center gap-2 bg-muted/50 p-1.5 rounded-xl border border-border">
                      <Button
                        size="sm"
                        variant={logisticsActiveTab === "trips" ? "default" : "ghost"}
                        className="text-xs h-8 font-semibold"
                        onClick={() => setLogisticsActiveTab("trips")}
                      >
                        <Truck className="size-3.5 mr-1.5" />
                        Active & Completed Trips ({dbDeliveries.length})
                      </Button>
                      <Button
                        size="sm"
                        variant={logisticsActiveTab === "order_desk" ? "default" : "ghost"}
                        className="text-xs h-8 font-semibold"
                        onClick={() => setLogisticsActiveTab("order_desk")}
                      >
                        <Package className="size-3.5 mr-1.5" />
                        Order Desk: Ready for Assignment ({ordersReadyForAssignment.length})
                      </Button>
                    </div>
                  )}
                </div>

                {/* DRIVER NOTICE (If Driver) */}
                {isDriver && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <Truck className="size-4" />
                      </span>
                      <div>
                        <p className="font-bold text-foreground">Assigned Delivery Trips</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Only trips assigned to you by the Order Desk appear here. You can open
                          commercial invoices, navigate to destinations, and record complete,
                          partial, or failed PODs.
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-primary shrink-0">
                      {driverTrips.length} Trips Assigned
                    </span>
                  </div>
                )}

                {/* VIEW 1: TRIPS (Driver View or Order Desk Trips View) */}
                {(isDriver || logisticsActiveTab === "trips") && (
                  <div
                    className={
                      isDriver
                        ? "grid grid-cols-1 gap-4"
                        : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    }
                  >
                    {driverTrips.map((delivery) => {
                      const order = dbOrders.find((o) => o.id === delivery.order_id);
                      const matchingCustomer = dbCustomers.find(
                        (c) => c.name === order?.customer_name,
                      );
                      const invoice = dbInvoices.find(
                        (i) => i.order_id === delivery.order_id || i.id === delivery.invoice_id,
                      );

                      return (
                        <article
                          className="logistics-card flex flex-col justify-between"
                          key={delivery.id || delivery.order_id}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <Truck size={18} />
                              </span>
                              <span
                                className={`status ${
                                  delivery.status === "Delivered"
                                    ? "success"
                                    : delivery.status === "Partially Delivered"
                                      ? "warning"
                                      : delivery.status === "Failed"
                                        ? "danger"
                                        : "brand"
                                }`}
                              >
                                {delivery.status}
                              </span>
                            </div>

                            <div className="mt-3">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                                Order #{delivery.order_id} ·{" "}
                                {companies.find((c) => c.id === delivery.company_id)?.short}
                              </span>
                              <h3 className="text-base font-extrabold text-foreground tracking-tight mt-0.5">
                                {order?.customer_name || "Customer"}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {order?.items_summary || "Order Items"}
                              </p>
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-xs font-semibold">
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                                  {order?.total_amount ? money(order.total_amount) : "—"}
                                </span>
                                {invoice && (
                                  <span className="text-[11px] font-mono text-muted-foreground">
                                    Inv #{invoice.id}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Trip Assignment Details */}
                            <div className="mt-3 p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground font-medium">
                                  Vehicle No:
                                </span>
                                <span className="font-bold font-mono text-foreground">
                                  {delivery.vehicle_number}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground font-medium">Driver:</span>
                                <span className="font-semibold text-foreground">
                                  {delivery.driver_name}
                                </span>
                              </div>
                              {delivery.remarks && (
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-muted-foreground font-medium">
                                    Schedule:
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {delivery.remarks.split(" | ")[0]}
                                  </span>
                                </div>
                              )}
                              {order?.delivery_address && (
                                <div className="pt-2 border-t border-border/50 text-[11px]">
                                  <span className="text-muted-foreground block font-medium">
                                    Delivery Address:
                                  </span>
                                  <span className="text-foreground font-medium mt-0.5 block">
                                    {order.delivery_address}
                                  </span>
                                </div>
                              )}
                              {matchingCustomer?.phone && (
                                <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                                  <span className="text-muted-foreground">Customer Phone:</span>
                                  <a
                                    href={`tel:${matchingCustomer.phone}`}
                                    className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                                  >
                                    <Phone className="size-3" />
                                    <span>{matchingCustomer.phone}</span>
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-border space-y-3">
                            {/* INVOICE VIEWER BUTTON (MANDATORY REQUIREMENT: Driver must be able to open/read invoice) */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full h-9 text-xs font-semibold gap-1.5"
                              onClick={() => handleOpenInvoiceModal(delivery.order_id)}
                            >
                              <FileCheck2 className="size-3.5 text-primary" />
                              View Commercial Invoice
                            </Button>

                            {(delivery.gps_latitude != null ||
                              (delivery.photos && delivery.photos.length > 0)) && (
                              <div className="space-y-2">
                                {delivery.gps_latitude != null && (
                                  <a
                                    href={`https://maps.google.com/?q=${delivery.gps_latitude},${delivery.gps_longitude ?? ""}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/20 transition-colors"
                                  >
                                    <MapPin className="size-3.5 shrink-0" />
                                    <span>
                                      GPS: {Number(delivery.gps_latitude).toFixed(4)},{" "}
                                      {delivery.gps_longitude != null
                                        ? Number(delivery.gps_longitude).toFixed(4)
                                        : "—"}{" "}
                                      ↗
                                    </span>
                                  </a>
                                )}
                                {delivery.photos && delivery.photos.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {delivery.photos.map((photoUrl, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setSelectedVisitPhoto(photoUrl)}
                                        className="size-14 rounded-xl overflow-hidden border border-border hover:border-primary shadow-xs cursor-pointer"
                                        title="Delivery photo"
                                      >
                                        <img
                                          src={photoUrl}
                                          alt={`Delivery proof ${idx + 1}`}
                                          className="w-full h-full object-cover"
                                        />
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* POD ACTION FOR OUT FOR DELIVERY */}
                            {delivery.status === "Out for delivery" && (
                              <Button
                                size="sm"
                                className="w-full h-9 text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-xs"
                                onClick={() => handleOpenPodModal(delivery)}
                              >
                                <Check className="size-3.5" />
                                Submit Proof of Delivery (POD)
                              </Button>
                            )}

                            {/* STATUS OUTCOME BADGES */}
                            {delivery.status === "Delivered" && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-success py-2 bg-success/10 rounded-lg border border-success/20">
                                  <Check className="size-4" />
                                  <span>Delivered in Full (POD Verified)</span>
                                </div>
                                {(() => {
                                  const isMfr =
                                    delivery.transport_mode === "Manufacturer Vehicle" ||
                                    delivery.vehicle_number === "Manufacturer Arranged" ||
                                    delivery.vehicle_number?.toLowerCase().includes("manufacturer");
                                  if (isMfr) {
                                    return (
                                      <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[11px] font-semibold text-center border border-blue-500/20">
                                        Manufacturer-Arranged Transport (Direct Collection)
                                      </div>
                                    );
                                  }

                                  const vPlate = delivery.vehicle_number;
                                  const matchedVeh = dbVehicles.find(
                                    (v) =>
                                      v.plate_number.toUpperCase() === vPlate?.toUpperCase() ||
                                      v.id.toUpperCase() === vPlate?.toUpperCase(),
                                  );
                                  const currentStatus =
                                    matchedVeh?.status || "Dispatched / On Delivery";
                                  const isAvailable =
                                    currentStatus === "Available / At Godown" ||
                                    currentStatus === "Returned to Godown";
                                  const canUpdateReturn =
                                    currentUser?.role === "logistics" ||
                                    currentUser?.role === "supervisor" ||
                                    isSuperAdmin ||
                                    hasPermission("logistics.dispatch");

                                  return (
                                    <div className="rounded-xl border border-border p-2.5 bg-muted/20 space-y-2 text-xs">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] text-muted-foreground font-medium">
                                          Vehicle Status:
                                        </span>
                                        <span
                                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                            isAvailable
                                              ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                                              : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                                          }`}
                                        >
                                          {currentStatus}
                                        </span>
                                      </div>
                                      {canUpdateReturn && !isAvailable && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="w-full text-xs font-semibold h-8 gap-1.5 cursor-pointer text-primary hover:bg-primary/10 border-primary/30"
                                          onClick={() => handleMarkVehicleReturned(vPlate)}
                                        >
                                          <Truck className="size-3.5" />
                                          Mark Returned to Godown / Available
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}

                            {delivery.status === "Partially Delivered" && (
                              <div className="flex flex-col items-center justify-center gap-0.5 text-xs font-bold text-warning py-2 bg-warning/10 rounded-lg border border-warning/20">
                                <span>Partially Delivered</span>
                                <span className="text-[10px] font-normal text-muted-foreground">
                                  Qty: {delivery.delivered_quantity} delivered ·{" "}
                                  {delivery.remaining_quantity} returned
                                </span>
                              </div>
                            )}

                            {delivery.status === "Failed" && (
                              <div className="flex flex-col items-center justify-center gap-0.5 text-xs font-bold text-danger py-2 bg-danger/10 rounded-lg border border-danger/20">
                                <span>Delivery Attempt Failed</span>
                                {delivery.failure_reason && (
                                  <span className="text-[10px] font-normal text-muted-foreground">
                                    Reason: {delivery.failure_reason}
                                  </span>
                                )}
                              </div>
                            )}

                            {isSuperAdmin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="w-full h-7 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                                onClick={() => {
                                  setDeleteTarget({
                                    type: "Delivery Dispatch",
                                    id: delivery.id || delivery.order_id,
                                    name: `Dispatch for Order #${delivery.order_id}`,
                                    onDelete: async () => {
                                      if (delivery.id)
                                        await deleteDelivery(delivery.id, currentUser?.name);
                                      setDbDeliveries((prev) =>
                                        prev.filter((d) => d.id !== delivery.id),
                                      );
                                    },
                                  });
                                }}
                              >
                                <Trash2 className="size-3 mr-1" />
                                Delete Trip (Super Admin)
                              </Button>
                            )}
                          </div>
                        </article>
                      );
                    })}

                    {driverTrips.length === 0 && (
                      <div className="col-span-full py-12 text-center rounded-2xl border border-dashed border-border bg-card p-8">
                        <Truck className="size-8 mx-auto text-muted-foreground/50 mb-3" />
                        <h3 className="text-sm font-bold text-foreground">
                          {isDriver ? "No Delivery Trips Assigned" : "No Trips In Queue"}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                          {isDriver
                            ? "You do not have any active delivery trips assigned. Trips assigned to your name by the Order Desk will appear here automatically."
                            : "No active or completed delivery trips found. Assign vehicles to ready orders via the Order Desk tab."}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* VIEW 2: ORDER DESK: READY FOR ASSIGNMENT (Only for authorized users, NOT drivers) */}
                {!isDriver && logisticsActiveTab === "order_desk" && (
                  <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-foreground">
                          Orders Awaiting Vehicle & Driver Assignment
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Accounts has generated commercial invoices for these approved orders.
                          Assign a delivery date, time window, vehicle, and driver to release them
                          to the logistics queue.
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                        {ordersReadyForAssignment.length} Invoiced Orders
                      </span>
                    </div>

                    <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>ORDER / CUSTOMER</th>
                          <th>ATTACHED INVOICE</th>
                          <th>ITEMS & VALUE</th>
                          <th>DELIVERY DESTINATION</th>
                          <th className="text-right">ASSIGNMENT ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ordersReadyForAssignment.map((o) => {
                          const matchingInv = dbInvoices.find(
                            (i) =>
                              i.order_id === o.id || i.id === `INV-${o.id.replace("ORD-", "")}`,
                          );

                          return (
                            <tr key={o.id}>
                              <td>
                                <p className="font-semibold text-foreground">{o.customer_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  #{o.id} · {companies.find((c) => c.id === o.company_id)?.short}
                                </p>
                              </td>
                              <td>
                                {matchingInv ? (
                                  <button
                                    onClick={() => handleOpenInvoiceModal(o.id)}
                                    className="inline-flex items-center gap-1 font-mono text-xs font-bold text-primary hover:underline"
                                  >
                                    <FileCheck2 className="size-3" />
                                    <span>#{matchingInv.id}</span>
                                  </button>
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    Awaiting Invoice
                                  </span>
                                )}
                              </td>
                              <td>
                                <p className="text-xs text-foreground font-medium">
                                  {o.items_summary || "Items"}
                                </p>
                                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                  {money(o.total_amount)}
                                </p>
                              </td>
                              <td className="text-xs text-muted-foreground max-w-xs truncate">
                                {o.delivery_address || "Standard Client Warehouse"}
                              </td>
                              <td className="text-right">
                                {canAssignVehicle ? (
                                  <Button
                                    size="sm"
                                    className="h-8 text-xs font-bold gap-1.5"
                                    onClick={() => openDispatchModal(o)}
                                  >
                                    <Truck className="size-3.5" />
                                    Assign Vehicle & Driver
                                  </Button>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">
                                    Order Desk / Supervisor Only
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}

                        {ordersReadyForAssignment.length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              className="py-12 text-center text-xs text-muted-foreground"
                            >
                              No invoiced orders currently awaiting vehicle assignment.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      ) : module === "field-visits" ? (
        <div className="space-y-6">
          {tab === "Log a visit" ? (
            /* CLEAN LOG VISIT FORM */
            <div className="panel max-w-3xl mx-auto p-6 md:p-8 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-foreground">
                    Log Field Visit
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Record on-site meeting outcomes, GPS coordinates, voice memo and photos
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTab("Visit history")}
                  className="text-xs font-semibold cursor-pointer"
                >
                  ← Back to History
                </Button>
              </div>

              {visitSuccessNotice && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2.5">
                  <Check className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{visitSuccessNotice}</span>
                </div>
              )}

              {/* 1. Entity & Client Account */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Building2 className="size-3.5 text-primary" />
                  <span>1. Operating Company & Client</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Company Workspace
                    </label>
                    <select
                      value={visitFirm}
                      onChange={(e) => {
                        setVisitFirm(e.target.value);
                        setVisitSelectedCustomer("");
                      }}
                      className="w-full text-xs font-semibold h-10 px-3 rounded-lg border border-border bg-background cursor-pointer"
                    >
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                      Client Account
                    </label>
                    <select
                      value={visitSelectedCustomer}
                      onChange={(e) => setVisitSelectedCustomer(e.target.value)}
                      className="w-full text-xs font-semibold h-10 px-3 rounded-lg border border-border bg-background cursor-pointer"
                    >
                      <option value="">-- Choose client account --</option>
                      {dbCustomers
                        .filter((c) => c.company_id === visitFirm || company === "all")
                        .map((c) => (
                          <option key={c.id || c.name} value={c.name}>
                            {c.name} {c.contact_person ? `(${c.contact_person})` : ""}{" "}
                            {c.city ? `· ${c.city}` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Visit Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1 flex items-center gap-1.5">
                      <CalendarDays className="size-3 text-primary" /> Visit Date
                    </label>
                    <input
                      type="date"
                      value={visitLogDate}
                      onChange={(e) => setVisitLogDate(e.target.value)}
                      className="w-full text-xs font-semibold h-10 px-3 rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1 flex items-center gap-1.5">
                      <Clock className="size-3 text-primary" /> Visit Time
                    </label>
                    <input
                      type="time"
                      value={visitLogTime}
                      onChange={(e) => setVisitLogTime(e.target.value)}
                      className="w-full text-xs font-semibold h-10 px-3 rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Visit Mission & Purpose (With Custom Option) */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <label className="text-xs font-bold text-foreground flex items-center gap-2">
                  <CalendarDays className="size-3.5 text-primary" />
                  <span>2. Visit Mission & Purpose</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Follow-up",
                    "Order booking",
                    "Payment collection",
                    "Sample delivery",
                    "Complaint resolution",
                    "New client pitch",
                    "Custom",
                  ].map((p) => {
                    const isSelected = visitPurpose === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setVisitPurpose(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {p === "Custom" ? "✨ Custom Purpose..." : p}
                      </button>
                    );
                  })}
                </div>
                {visitPurpose === "Custom" && (
                  <div className="pt-1 animate-in fade-in">
                    <input
                      type="text"
                      required
                      value={visitCustomPurpose}
                      onChange={(e) => setVisitCustomPurpose(e.target.value)}
                      placeholder="Type custom mission / purpose (e.g. Machinery Inspection, Quality Audit)..."
                      className="w-full text-xs font-semibold h-10 px-3 rounded-lg border border-primary bg-background focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}
              </div>

              {/* 3. Discussion Notes & Outcome */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-2">
                    <FileCheck2 className="size-3.5 text-primary" />
                    <span>3. Discussion Notes & Outcome</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {visitRequirement.length} chars
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={visitRequirement}
                  onChange={(e) => setVisitRequirement(e.target.value)}
                  placeholder="Record customer discussion, product interest, approved quantities, negotiated rates, next steps..."
                  className="w-full text-xs font-medium p-3 rounded-lg border border-border bg-background resize-none focus:border-primary focus:ring-1 focus:ring-primary leading-relaxed"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground mr-1">
                    Quick insert:
                  </span>
                  {[
                    "Sample batch approved",
                    "Price negotiated: Ready for PO",
                    "Payment promised within 48h",
                    "Follow-up scheduled for next week",
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setVisitRequirement((prev) => (prev ? `${prev}. ${tag}` : tag))
                      }
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border bg-muted/40 hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. On-site Verification Deck (GPS, Audio Memo, Proof Photos) */}
              <div className="space-y-3 pt-2 border-t border-border/60">
                <label className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Navigation className="size-3.5 text-primary" />
                  <span>4. On-Site Verification Deck</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* GPS Box */}
                  <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <MapPin className="size-3.5 text-primary" /> GPS Location
                      </span>
                      {gpsLocation && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Locked
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {gpsLocation
                        ? `${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)}`
                        : "No coordinates acquired"}
                    </p>
                    <button
                      type="button"
                      onClick={handleAddGpsAndPhotos}
                      className="w-full py-1.5 px-2 rounded-lg text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MapPin className="size-3" />
                      <span>{gpsLocation ? "Refresh GPS" : "Acquire GPS"}</span>
                    </button>
                  </div>

                  {/* Audio Memo Box */}
                  <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Mic className="size-3.5 text-primary" /> Audio Memo
                      </span>
                      {hasVoiceNote && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Recorded ({recordingDuration}s)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {isRecording
                        ? `Recording (${recordingDuration}s)... speak into microphone`
                        : hasVoiceNote
                          ? "Voice memo captured"
                          : "Record live audio briefing"}
                    </p>
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isRecording) {
                            startVoiceRecording();
                          } else {
                            stopVoiceRecording();
                          }
                        }}
                        className={`w-full py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                          isRecording
                            ? "bg-red-500 text-white animate-pulse"
                            : hasVoiceNote
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                        }`}
                      >
                        {isRecording ? <MicOff className="size-3" /> : <Mic className="size-3" />}
                        <span>
                          {isRecording
                            ? `Stop Recording (${recordingDuration}s)`
                            : hasVoiceNote
                              ? "Re-record Mic Memo"
                              : "Record Live Voice Memo"}
                        </span>
                      </button>

                      {hasVoiceNote && voiceAudioDataUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isPlayingPreview) {
                              stopCurrentAudio();
                            } else {
                              setIsPlayingPreview(true);
                              playRecordedAudioUrl(
                                voiceAudioDataUrl,
                                recordingDuration || 8,
                                () => setIsPlayingPreview(false),
                              );
                            }
                          }}
                          className="w-full py-1 px-2 rounded-lg text-[11px] font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {isPlayingPreview ? (
                            <Pause className="size-3 text-primary" />
                          ) : (
                            <Play className="size-3 text-primary" />
                          )}
                          <span>
                            {isPlayingPreview ? "Pause Preview" : "Listen to What You Spoke"}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Proof Photos Box */}
                  <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Camera className="size-3.5 text-primary" /> Proof Photos
                      </span>
                      {proofPhotos.length > 0 && (
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {proofPhotos.length} photo(s)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {proofPhotos.length > 0
                        ? `${proofPhotos.length} attached`
                        : "Storefront / signed slip"}
                    </p>
                    <input
                      id="proof-photos-input"
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById("proof-photos-input");
                        if (input) input.click();
                      }}
                      className="w-full py-1.5 px-2 rounded-lg text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="size-3" />
                      <span>Attach Photo(s)</span>
                    </button>
                  </div>
                </div>

                {proofPhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {proofPhotos.map((photo, idx) => (
                      <div
                        key={idx}
                        className="relative size-14 rounded-lg overflow-hidden border border-border shadow-xs group"
                      >
                        <img
                          src={photo}
                          alt={`Proof ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            if (e.currentTarget.src !== FALLBACK_PROOF_IMAGE) {
                              e.currentTarget.src = FALLBACK_PROOF_IMAGE;
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setProofPhotos((photos) => photos.filter((_, i) => i !== idx))
                          }
                          className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
                <Button
                  onClick={handleSaveVisit}
                  className="flex-1 h-10 font-bold text-xs cursor-pointer"
                >
                  <Check className="size-3.5 mr-1.5" />
                  Save Visit Record
                </Button>
                <Button
                  onClick={handleCreateOrderFromVisit}
                  variant="outline"
                  className="flex-1 h-10 font-bold text-xs cursor-pointer"
                >
                  <ShoppingBag className="size-3.5 mr-1.5" />
                  Convert to Sales Order
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setTab("Visit history")}
                  className="h-10 text-xs text-muted-foreground cursor-pointer"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            /* CLEAN LOGGED VISITS HISTORY VIEW (DEFAULT) */
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border border-border bg-card shadow-2xs">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Total Visits
                  </span>
                  <p className="text-xl font-black text-foreground mt-1">
                    {visibleFieldVisits.length}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card shadow-2xs">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Completed
                  </span>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {visibleFieldVisits.filter((v) => v.status === "Completed").length}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card shadow-2xs">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    GPS Geotagged
                  </span>
                  <p className="text-xl font-black text-primary mt-1">
                    {visibleFieldVisits.filter((v) => v.gps_latitude).length}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card shadow-2xs">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                    Voice Briefings
                  </span>
                  <p className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1">
                    {visibleFieldVisits.filter((v) => v.voice_recording_path).length}
                  </p>
                </div>
              </div>

              {/* Logged Visits Cards */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Logged Field Visits</h3>
                    <p className="text-xs text-muted-foreground">
                      {canViewAllFieldVisits
                        ? `${visibleFieldVisits.length} visits recorded across ${
                            company === "all"
                              ? "all companies"
                              : companies.find((c) => c.id === company)?.short
                          }`
                        : `${visibleFieldVisits.length} field visits logged by you`}
                    </p>
                  </div>
                  {hasPermission("field_visits.conduct") && (
                    <Button
                      size="sm"
                      onClick={() => setTab("Log a visit")}
                      className="text-xs font-semibold cursor-pointer self-start sm:self-auto"
                    >
                      <Plus className="size-3.5 mr-1" />
                      Log Field Visit
                    </Button>
                  )}
                </div>

                {/* Filter Toolbar (Sales Person Dropdown for Supervisor/Admin, or User Notice) */}
                {canViewAllFieldVisits ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border shadow-2xs">
                    <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
                      <UserCheck className="size-4 text-primary shrink-0" />
                      <span className="text-xs font-semibold text-foreground shrink-0">
                        Filter by Sales Person:
                      </span>
                      <select
                        aria-label="Filter field visits by sales person"
                        value={visitSalesFilter}
                        onChange={(e) => setVisitSalesFilter(e.target.value)}
                        className="text-xs py-1.5 px-3 rounded-lg border border-border bg-background text-foreground font-medium focus:outline-hidden focus:ring-1 focus:ring-primary cursor-pointer max-w-xs"
                      >
                        <option value="All">
                          All Sales Representatives ({visibleFieldVisits.length})
                        </option>
                        {Array.from(
                          new Set([
                            ...visibleFieldVisits.map((v) => v.assigned_to_name).filter(Boolean),
                            ...visibleFieldVisits.map((v) => v.creator_name).filter(Boolean),
                          ] as string[]),
                        )
                          .filter(Boolean)
                          .map((officer) => {
                            const count = visibleFieldVisits.filter((v) => {
                              const oLower = officer.toLowerCase();
                              return (
                                (v.assigned_to_name &&
                                  v.assigned_to_name.toLowerCase().includes(oLower)) ||
                                (v.creator_name && v.creator_name.toLowerCase().includes(oLower))
                              );
                            }).length;
                            return (
                              <option key={officer} value={officer}>
                                {officer} ({count} {count === 1 ? "visit" : "visits"})
                              </option>
                            );
                          })}
                      </select>

                      {visitSalesFilter !== "All" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setVisitSalesFilter("All")}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <X className="size-3 mr-1" />
                          Reset
                        </Button>
                      )}
                    </div>

                    <span className="text-xs text-muted-foreground">
                      Showing{" "}
                      <strong className="text-foreground">
                        {
                          visibleFieldVisits.filter((v) => {
                            if (visitSalesFilter === "All") return true;
                            const fLower = visitSalesFilter.toLowerCase();
                            return (
                              (v.assigned_to_name &&
                                v.assigned_to_name.toLowerCase().includes(fLower)) ||
                              (v.creator_name && v.creator_name.toLowerCase().includes(fLower))
                            );
                          }).length
                        }
                      </strong>{" "}
                      of {visibleFieldVisits.length} visits
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border shadow-2xs text-xs text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <UserCheck className="size-4 text-primary" />
                      Showing only visits logged by you (<strong>{currentUser?.name}</strong>)
                    </span>
                    <span>{visibleFieldVisits.length} visits</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {visibleFieldVisits
                    .filter((v) => {
                      if (!canViewAllFieldVisits || visitSalesFilter === "All") return true;
                      const fLower = visitSalesFilter.toLowerCase();
                      return (
                        (v.assigned_to_name && v.assigned_to_name.toLowerCase().includes(fLower)) ||
                        (v.creator_name && v.creator_name.toLowerCase().includes(fLower))
                      );
                    })
                    .map((v) => (
                      <article
                        className="p-5 rounded-2xl border border-border bg-card hover:border-primary/50 transition-all shadow-xs space-y-3 flex flex-col justify-between"
                        key={v.id || v.customer_name}
                      >
                        <div className="space-y-2.5">
                          {/* Top row */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/60 px-2 py-0.5 rounded-md">
                              <Building2 className="size-3 text-primary" />
                              {companies.find((c) => c.id === v.company_id)?.short || "Firm"}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-muted-foreground">
                                {v.scheduled_date} · {v.scheduled_time}
                              </span>
                              <span
                                className={`status ${v.status === "Completed" ? "success" : "brand"}`}
                              >
                                {v.status}
                              </span>
                            </div>
                          </div>

                          {/* Customer & Purpose */}
                          <div>
                            <h4 className="text-base font-black text-foreground tracking-tight">
                              {v.customer_name}
                            </h4>
                            <span className="inline-block mt-0.5 text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              {v.purpose}
                            </span>
                          </div>

                          {/* Outcome Notes */}
                          {v.outcome_notes && (
                            <div className="p-3 rounded-xl bg-muted/30 border border-border/70 text-xs text-foreground leading-relaxed">
                              {v.outcome_notes}
                            </div>
                          )}

                          {/* VERIFICATION & MEDIA (Visible & Interactive for Super Admin, Supervisor, and Sales) */}
                          <div className="pt-2 border-t border-border/60 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* GPS Geotag Link */}
                              {v.gps_latitude ? (
                                <a
                                  href={`https://maps.google.com/?q=${v.gps_latitude},${v.gps_longitude || 77.5946}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/20 transition-colors"
                                  title="Click to view on Google Maps"
                                >
                                  <MapPin className="size-3.5 shrink-0" />
                                  <span>
                                    GPS: {v.gps_latitude.toFixed(4)}, {v.gps_longitude?.toFixed(4)}{" "}
                                    ↗
                                  </span>
                                </a>
                              ) : null}

                              {/* Voice Recording Player Button (CLICKABLE!) */}
                              {v.voice_recording_path ? (
                                <button
                                  type="button"
                                  onClick={() => playAudioMemo(v)}
                                  className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-lg border border-primary/20 transition-colors cursor-pointer"
                                  title="Click to listen to voice memo"
                                >
                                  {isPlayingAudio && selectedVisitAudio?.id === v.id ? (
                                    <>
                                      <Pause className="size-3 shrink-0 text-primary" />
                                      <span>Playing Audio... ({audioTimer}s)</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play className="size-3 shrink-0" />
                                      <span>
                                        Play Voice Memo{" "}
                                        {v.voice_recording_path.match(/\d+s/)?.[0]
                                          ? `(${v.voice_recording_path.match(/\d+s/)?.[0]})`
                                          : ""}
                                      </span>
                                    </>
                                  )}
                                </button>
                              ) : null}
                            </div>

                            {/* Attached Proof Photos (CLICKABLE!) */}
                            {v.photos && v.photos.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                                  Attached Photos ({v.photos.length})
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                  {v.photos.map((photoUrl, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setSelectedVisitPhoto(photoUrl)}
                                      className="size-14 rounded-xl overflow-hidden border border-border hover:border-primary hover:scale-105 transition-all shadow-xs cursor-pointer group bg-muted/40"
                                      title="Click to view full photo"
                                    >
                                      <img
                                        src={photoUrl}
                                        alt={`Proof ${idx + 1}`}
                                        className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                                        onError={(e) => {
                                          if (e.currentTarget.src !== FALLBACK_PROOF_IMAGE) {
                                            e.currentTarget.src = FALLBACK_PROOF_IMAGE;
                                          }
                                        }}
                                      />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Footer */}
                        <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                          <span className="text-muted-foreground font-medium">
                            Assigned: {v.assigned_to_name}
                          </span>
                          <div className="flex items-center gap-2">
                            {/* 1-Time Sales Edit or Admin/Supervisor Edit */}
                            {(() => {
                              const isEdited =
                                v.outcome_notes?.includes("[Edited once") ||
                                v.outcome_notes?.includes("[Edited on");
                              const isSalesUser = currentUser?.role === "sales";

                              if (isSalesUser) {
                                if (isEdited) {
                                  return (
                                    <span
                                      className="text-[10px] font-semibold text-muted-foreground bg-muted/70 px-2 py-1 rounded-md border border-border flex items-center gap-1"
                                      title="This visit log has been edited once and cannot be modified again by sales."
                                    >
                                      <Lock className="size-2.5 text-muted-foreground" />
                                      Edited (1/1 limit reached)
                                    </span>
                                  );
                                }
                                return (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs font-semibold cursor-pointer text-primary border-primary/30 hover:bg-primary/10"
                                    onClick={() => openEditVisit(v)}
                                    title="Sales representatives may edit their visit log once."
                                  >
                                    <Pencil className="size-3 mr-1" />
                                    Edit Log (1 time)
                                  </Button>
                                );
                              }

                              if (isSuperAdmin || isSupervisor) {
                                return (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs font-semibold cursor-pointer"
                                    onClick={() => openEditVisit(v)}
                                    title="Edit visit record"
                                  >
                                    <Pencil className="size-3 mr-1" />
                                    Edit Visit
                                  </Button>
                                );
                              }
                              return null;
                            })()}

                            {isSuperAdmin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10 cursor-pointer"
                                title="Delete Field Visit (Super Admin)"
                                onClick={() => {
                                  setDeleteTarget({
                                    type: "Field Visit",
                                    id: v.id || v.customer_name,
                                    name: `${v.customer_name} (${v.purpose})`,
                                    onDelete: async () => {
                                      if (v.id) await deleteFieldVisit(v.id, currentUser?.name);
                                      setDbVisits((prev) => prev.filter((x) => x.id !== v.id));
                                    },
                                  });
                                }}
                              >
                                <Trash2 className="size-3.5 mr-1" />
                                Delete
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs font-semibold cursor-pointer"
                              onClick={() => {
                                navigateToCreateOrder({
                                  customerName: v.customer_name,
                                  companyId: v.company_id,
                                  notes:
                                    v.outcome_notes || `Converted from field visit (${v.purpose})`,
                                });
                              }}
                            >
                              Create order
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))}
                </div>

                {visibleFieldVisits.length > 0 &&
                  visibleFieldVisits.filter((v) => {
                    if (!canViewAllFieldVisits || visitSalesFilter === "All") return true;
                    const fLower = visitSalesFilter.toLowerCase();
                    return (
                      (v.assigned_to_name && v.assigned_to_name.toLowerCase().includes(fLower)) ||
                      (v.creator_name && v.creator_name.toLowerCase().includes(fLower))
                    );
                  }).length === 0 && (
                    <div className="p-12 text-center rounded-2xl border border-dashed border-border text-muted-foreground text-xs space-y-3">
                      <p>
                        No field visits found assigned to sales representative{" "}
                        <strong className="text-foreground">"{visitSalesFilter}"</strong>.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setVisitSalesFilter("All")}
                        className="cursor-pointer"
                      >
                        Show All Sales Representatives
                      </Button>
                    </div>
                  )}

                {visibleFieldVisits.length === 0 && (
                  <div className="p-12 text-center rounded-2xl border border-dashed border-border text-muted-foreground text-xs space-y-3">
                    <p>
                      {canViewAllFieldVisits
                        ? "No field visits logged yet."
                        : "You haven't logged any field visits yet."}
                    </p>
                    {hasPermission("field_visits.conduct") && (
                      <Button size="sm" onClick={() => setTab("Log a visit")}>
                        <Plus className="size-3.5 mr-1" />
                        Log Your First Field Visit
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : module === "purchases" ? (
        <section className="panel">
          <div className="panel-head border-b border-border">
            <div>
              <h2 className="panel-title">Procurement overview</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Purchase orders inbound to inventory
              </p>
            </div>
            {hasPermission("purchases.create") && (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold"
                onClick={() => setPoModal(true)}
              >
                <Plus className="size-3.5" />
                Create Purchase Order
              </Button>
            )}
          </div>
          {dbPOs.map((p) => (
            <div
              className="flex flex-wrap items-center justify-between gap-4 border-t border-border px-6 py-5"
              key={p.id}
            >
              <div className="flex items-center gap-4">
                <Package className="text-primary" size={20} />
                <div>
                  <p className="text-xs font-bold">{p.product_name}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    #{p.id} · {p.quantity} {p.unit} ·{" "}
                    {companies.find((c) => c.id === p.company_id)?.short} · Supplier:{" "}
                    {p.supplier_name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`status ${p.status === "Received" ? "success" : "brand"}`}>
                  {p.status}
                </span>
                {p.status !== "Received" && hasPermission("purchases.receive") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleReceiveGoods(p)}
                  >
                    Receive Goods
                  </Button>
                )}
                {(isSuperAdmin || isSupervisor) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"
                    title="Edit Purchase Order (Super Admin & Supervisor)"
                    onClick={() => openEditPo(p)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                )}
                {(isSuperAdmin || isSupervisor) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    title="Delete Purchase Order (Super Admin & Supervisor)"
                    onClick={() => {
                      setDeleteTarget({
                        type: "Purchase Order",
                        id: p.id,
                        name: `#${p.id} · ${p.product_name} (${p.supplier_name})`,
                        onDelete: async () => {
                          await deletePurchaseOrder(p.id, currentUser?.name);
                          setDbPOs((prev) => prev.filter((x) => x.id !== p.id));
                        },
                      });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          {dbPOs.length === 0 && (
            <p className="p-8 text-center text-muted-foreground">
              No purchase orders found. Create a purchase order to record inbound supplier
              procurement.
            </p>
          )}
        </section>
      ) : (
        <div className="module-grid">
          {rows.map((o) => (
            <article className="module-item" key={o.id}>
              <span className="avatar size-10 text-xs">
                {o.customer_name.substring(0, 2).toUpperCase()}
              </span>
              <h2 className="mt-4 font-bold">{o.customer_name}</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                {companies.find((c) => c.id === o.company_id)?.short}
              </p>
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Order total</p>
                  <p className="mt-1 text-sm font-bold">{money(o.total_amount)}</p>
                </div>
                <span className="status brand">{o.status}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* LEAD DETAILS & INTERACTIVE STAGE SHEET */}
      <Sheet
        open={!!selectedLeadDetails}
        onOpenChange={(open) => !open && setSelectedLeadDetails(null)}
      >
        <SheetContent className="overflow-y-auto max-h-screen">
          <SheetHeader>
            <SheetTitle>{selectedLeadDetails?.business_name || "Lead Details"}</SheetTitle>
            <SheetDescription>Inquiry profile, requirements and stage progression</SheetDescription>
          </SheetHeader>
          {selectedLeadDetails && (
            <div className="mt-6 space-y-6">
              {/* STAGE SELECTOR BAR */}
              <div>
                <p className="text-xs font-bold text-muted-foreground uppercase mb-2">
                  Stage Progression
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(["New", "Qualified", "Follow-up", "Converted"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleUpdateLeadStage(selectedLeadDetails.id!, st)}
                      className={`py-2 px-2.5 rounded-lg text-xs font-bold text-center border transition-all ${
                        selectedLeadDetails.stage === st
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-muted/50 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* CONTACT & COMPANY INFO */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Company Entity</span>
                  <span className="text-xs font-bold">
                    {companies.find((c) => c.id === selectedLeadDetails.company_id)?.name ||
                      "All Companies"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Contact Person</span>
                  <span className="text-xs font-bold">{selectedLeadDetails.contact_person}</span>
                </div>
                {selectedLeadDetails.phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Phone</span>
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${selectedLeadDetails.phone}`}
                        className="text-xs font-mono text-primary hover:underline"
                      >
                        {selectedLeadDetails.phone}
                      </a>
                      <a
                        href={`https://wa.me/${selectedLeadDetails.phone.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-600 hover:text-emerald-700"
                        title="WhatsApp"
                      >
                        <MessageSquare className="size-3.5" />
                      </a>
                    </div>
                  </div>
                )}
                {selectedLeadDetails.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Email</span>
                    <a
                      href={`mailto:${selectedLeadDetails.email}`}
                      className="text-xs text-primary hover:underline"
                    >
                      {selectedLeadDetails.email}
                    </a>
                  </div>
                )}
                {selectedLeadDetails.city && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">City</span>
                    <span className="text-xs font-medium">{selectedLeadDetails.city}</span>
                  </div>
                )}
                {selectedLeadDetails.gstin && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">GSTIN</span>
                    <span className="text-xs font-mono">{selectedLeadDetails.gstin}</span>
                  </div>
                )}
              </div>

              {/* COMMERCIAL DETAILS */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Deal Value</span>
                  <span className="text-sm font-extrabold text-foreground">
                    {money(selectedLeadDetails.estimated_value || 0)}
                  </span>
                </div>
                {selectedLeadDetails.product_interest && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Product Interest</span>
                    <span className="text-xs font-bold text-foreground">
                      {selectedLeadDetails.product_interest}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Source</span>
                  <span className="text-xs font-medium">
                    {selectedLeadDetails.source === "Referral" && selectedLeadDetails.referred_by
                      ? `Referral · ${selectedLeadDetails.referred_by}`
                      : selectedLeadDetails.source || "Direct"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Priority</span>
                  <span className="text-xs font-bold">
                    {selectedLeadDetails.priority || "Medium"}
                  </span>
                </div>
              </div>

              {/* REQUIREMENTS */}
              {selectedLeadDetails.requirement && (
                <div className="p-4 rounded-xl border border-border bg-muted/30">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase mb-1">
                    Requirement Notes
                  </p>
                  <p className="text-xs text-foreground italic leading-relaxed">
                    {selectedLeadDetails.requirement}
                  </p>
                </div>
              )}

              {/* ACTIONS */}
              <div className="pt-2 space-y-3">
                {selectedLeadDetails.stage === "Converted" ? (
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                        <Check className="size-4" />
                        <span className="text-xs font-bold">Converted to Active Customer</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="w-full h-10 font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                      onClick={() => {
                        setSelectedLeadDetails(null);
                        navigate({ to: "/customers" });
                      }}
                    >
                      <Users className="size-4 mr-2" />
                      View in Customers Workspace →
                    </Button>
                  </div>
                ) : hasPermission("leads.convert") ? (
                  <Button
                    type="button"
                    className="w-full h-10 font-bold cursor-pointer"
                    onClick={() => {
                      handleConvertLead(selectedLeadDetails);
                    }}
                  >
                    <UserCheck className="size-4 mr-2" />
                    Convert to Active Customer
                  </Button>
                ) : null}
                {canEditLead(currentUser?.role, {
                  sales: selectedLeadDetails.sales_edits || 0,
                  supervisor: selectedLeadDetails.supervisor_edits || 0,
                }) && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-9 font-bold text-xs gap-1.5 cursor-pointer"
                    onClick={() => openEditLead(selectedLeadDetails)}
                  >
                    <Pencil className="size-3.5" />
                    {currentUser?.role === "super_admin"
                      ? "Edit lead"
                      : `Edit lead (${2 - (currentUser?.role === "sales" ? selectedLeadDetails.sales_edits || 0 : selectedLeadDetails.supervisor_edits || 0)} left)`}
                  </Button>
                )}
                {(currentUser?.role === "sales" || currentUser?.role === "supervisor") &&
                  !canEditLead(currentUser.role, {
                    sales: selectedLeadDetails.sales_edits || 0,
                    supervisor: selectedLeadDetails.supervisor_edits || 0,
                  }) && (
                    <p className="text-[11px] text-muted-foreground text-center">
                      Edit limit reached (2/2)
                    </p>
                  )}
                {isSuperAdmin && (
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full h-9 font-bold text-xs gap-1.5 cursor-pointer"
                    onClick={() => {
                      const lead = selectedLeadDetails;
                      if (!lead) return;
                      setDeleteTarget({
                        type: "Lead",
                        id: lead.id || lead.business_name,
                        name: `${lead.business_name} (${lead.contact_person})`,
                        onDelete: async () => {
                          if (lead.id) await deleteLead(lead.id, currentUser?.name);
                          setDbLeads((prev) => prev.filter((x) => x.id !== lead.id));
                          setSelectedLeadDetails(null);
                        },
                      });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Delete Lead (Super Admin)
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* LEAD CREATION SHEET */}
      <Sheet
        open={leadModal}
        onOpenChange={(open) => {
          setLeadModal(open);
          if (!open) resetLeadForm();
        }}
      >
        <SheetContent className="overflow-y-auto max-h-screen">
          <SheetHeader>
            <SheetTitle>{editingLeadId ? "Edit lead" : "Add lead"}</SheetTitle>
            <SheetDescription>
              {editingLeadId
                ? "Update this inquiry. Sales and supervisor can each save twice."
                : "Log a new prospective customer inquiry"}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreateLead} className="mt-6 space-y-4">
            <label className="drawer-field">
              Company
              <select required value={leadCompany} onChange={(e) => setLeadCompany(e.target.value)}>
                <option value="all">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="drawer-field">
              Name
              <input
                required
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                placeholder="Business or lead name"
              />
            </label>
            <label className="drawer-field">
              Contact person
              <input
                required
                value={leadContact}
                onChange={(e) => setLeadContact(e.target.value)}
                placeholder="Contact person name"
              />
            </label>
            <label className="drawer-field">
              Phone
              <input
                type="tel"
                value={leadPhone}
                onChange={(e) => setLeadPhone(e.target.value)}
                placeholder="+91 98..."
              />
            </label>
            <label className="drawer-field">
              Email
              <input
                type="email"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="contact@business.com"
              />
            </label>
            <label className="drawer-field">
              GSTIN
              <input
                value={leadGstin}
                onChange={(e) => setLeadGstin(e.target.value)}
                placeholder="29AAAAA0000A1Z5"
              />
            </label>
            <label className="drawer-field">
              City
              <input
                value={leadCity}
                onChange={(e) => setLeadCity(e.target.value)}
                placeholder="Bengaluru"
              />
            </label>
            <label className="drawer-field">
              Product interest
              <input
                value={leadProductInterest}
                onChange={(e) => setLeadProductInterest(e.target.value)}
                placeholder="e.g. Skimmed Milk Powder, Condensed Milk"
              />
            </label>
            <label className="drawer-field">
              Estimated value (₹)
              <input
                type="number"
                value={leadEstimatedValue}
                onChange={(e) => setLeadEstimatedValue(e.target.value)}
                placeholder="50000"
              />
            </label>
            <label className="drawer-field">
              Source
              <select value={leadSource} onChange={(e) => setLeadSource(e.target.value)}>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Referral">Referral</option>
                <option value="Field Visit">Field Visit</option>
                <option value="Cold Call">Cold Call</option>
                <option value="Website">Website</option>
                <option value="Exhibition">Exhibition</option>
                <option value="Direct Inquiry">Direct Inquiry</option>
              </select>
            </label>
            {leadSource === "Referral" && (
              <label className="drawer-field">
                Referred by
                <input
                  required
                  value={leadReferrer}
                  onChange={(e) => setLeadReferrer(e.target.value)}
                  placeholder="Name of the person who referred this lead"
                />
              </label>
            )}
            <label className="drawer-field">
              Type
              <select value={leadType} onChange={(e) => setLeadType(e.target.value)}>
                <option value="Wholesale">Wholesale</option>
                <option value="Retailer">Retailer</option>
                <option value="Distributor">Distributor</option>
                <option value="Manufacturer">Manufacturer</option>
                <option value="Institutional">Institutional</option>
              </select>
            </label>
            <label className="drawer-field">
              Priority
              <select value={leadPriority} onChange={(e) => setLeadPriority(e.target.value)}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </label>
            <label className="drawer-field">
              Notes
              <textarea
                rows={3}
                required={leadSource === "Referral"}
                value={leadNotes}
                onChange={(e) => setLeadNotes(e.target.value)}
                placeholder={
                  leadSource === "Referral"
                    ? "How this referral came in"
                    : "Additional notes or conversation summary..."
                }
              />
            </label>
            <div className="flex items-center gap-3 pt-3">
              <Button type="submit" className="flex-1">
                {editingLeadId ? "Save changes" : "Save"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setLeadModal(false);
                  resetLeadForm();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* CUSTOMER CREATION SHEET */}
      <Sheet open={custModal} onOpenChange={setCustModal}>
        <SheetContent className="overflow-y-auto max-h-screen">
          <SheetHeader>
            <SheetTitle>Add customer</SheetTitle>
            <SheetDescription>Create customer profile directly</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreateCustomer} className="mt-6 space-y-4">
            <label className="drawer-field">
              Legal name
              <input
                required
                value={custLegalName}
                onChange={(e) => setCustLegalName(e.target.value)}
                placeholder="Registered business legal name"
              />
            </label>
            <label className="drawer-field">
              Trade name
              <input
                value={custTradeName}
                onChange={(e) => setCustTradeName(e.target.value)}
                placeholder="Doing business as name"
              />
            </label>
            <label className="drawer-field">
              Phone
              <input
                type="tel"
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
                placeholder="+91 98..."
              />
            </label>
            <label className="drawer-field">
              Email
              <input
                type="email"
                value={custEmail}
                onChange={(e) => setCustEmail(e.target.value)}
                placeholder="accounts@business.com"
              />
            </label>
            <label className="drawer-field">
              GSTIN
              <input
                value={custGstin}
                onChange={(e) => setCustGstin(e.target.value)}
                placeholder="29AAAAA0000A1Z5"
              />
            </label>
            <label className="drawer-field">
              Billing address
              <textarea
                rows={2}
                value={custBillingAddress}
                onChange={(e) => setCustBillingAddress(e.target.value)}
                placeholder="Registered billing address"
              />
            </label>
            <label className="drawer-field">
              Shipping address
              <textarea
                rows={2}
                value={custShippingAddress}
                onChange={(e) => setCustShippingAddress(e.target.value)}
                placeholder="Warehouse / delivery address"
              />
            </label>
            <label className="drawer-field">
              Customer type
              <select value={custType} onChange={(e) => setCustType(e.target.value)}>
                <option value="Wholesale">Wholesale</option>
                <option value="Retailer">Retailer</option>
                <option value="Distributor">Distributor</option>
                <option value="Corporate">Corporate</option>
                <option value="Institutional">Institutional</option>
              </select>
            </label>
            <label className="drawer-field">
              Contact person
              <input
                value={custContact}
                onChange={(e) => setCustContact(e.target.value)}
                placeholder="Primary contact name"
              />
            </label>
            <label className="drawer-field">
              Credit limit (₹)
              <input
                type="number"
                value={custCreditLimit}
                onChange={(e) => setCustCreditLimit(e.target.value)}
                placeholder="0"
              />
            </label>
            <label className="drawer-field" htmlFor="cust-credit-days">
              Credit days
              <input
                id="cust-credit-days"
                name="creditDays"
                type="number"
                min={1}
                value={custCreditDays}
                onChange={(e) => setCustCreditDays(e.target.value)}
                placeholder="30"
              />
            </label>
            <div className="flex items-center gap-3 pt-3">
              <Button type="submit" className="flex-1">
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setCustModal(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* EDIT CUSTOMER SHEET */}
      <Sheet open={editCustModal} onOpenChange={setEditCustModal}>
        <SheetContent className="overflow-y-auto max-h-screen">
          <SheetHeader>
            <SheetTitle>Edit Customer Profile</SheetTitle>
            <SheetDescription>
              Update phone number, email, address, and contact details for {editCustName}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleUpdateCustomer} className="mt-6 space-y-4">
            <label className="drawer-field">
              Customer / Business Name
              <input
                required
                value={editCustName}
                onChange={(e) => setEditCustName(e.target.value)}
                placeholder="Business legal name"
              />
            </label>
            <label className="drawer-field">
              Contact Person
              <input
                value={editCustContact}
                onChange={(e) => setEditCustContact(e.target.value)}
                placeholder="Owner / Procurement Manager"
              />
            </label>
            <label className="drawer-field">
              Phone Number
              <input
                type="tel"
                value={editCustPhone}
                onChange={(e) => setEditCustPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </label>
            <label className="drawer-field">
              Email Address
              <input
                type="email"
                value={editCustEmail}
                onChange={(e) => setEditCustEmail(e.target.value)}
                placeholder="contact@business.com"
              />
            </label>
            <label className="drawer-field">
              Full Physical / Billing Address
              <textarea
                rows={3}
                value={editCustAddress}
                onChange={(e) => setEditCustAddress(e.target.value)}
                placeholder="Street address, Area, City, State, PIN code"
              />
            </label>
            <label className="drawer-field">
              Commercial Notes & Terms
              <textarea
                rows={2}
                value={editCustNotes}
                onChange={(e) => setEditCustNotes(e.target.value)}
                placeholder="GSTIN, payment terms, delivery instructions..."
              />
            </label>
            <label className="drawer-field" htmlFor="edit-cust-credit-days">
              Credit days
              <input
                id="edit-cust-credit-days"
                name="creditDays"
                type="number"
                min={1}
                value={editCustCreditDays}
                onChange={(e) => setEditCustCreditDays(e.target.value)}
              />
            </label>
            <label className="drawer-field">
              Account Status
              <select
                value={editCustStatus}
                onChange={(e) => setEditCustStatus(e.target.value as "Active" | "Inactive")}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </label>
            <div className="flex items-center gap-3 pt-3">
              <Button type="submit" className="flex-1 cursor-pointer">
                Save Changes
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1 cursor-pointer"
                onClick={() => setEditCustModal(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* PRODUCT CREATION SHEET */}
      <Sheet open={prodModal} onOpenChange={setProdModal}>
        <SheetContent className="overflow-y-auto max-h-[100dvh] w-full sm:max-w-lg pb-16">
          <SheetHeader>
            <SheetTitle>Add Product</SheetTitle>
            <SheetDescription>Register a new product in the company catalog</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreateProduct} className="mt-6 space-y-4 pb-12">
            <label className="drawer-field">
              Company
              <select value={prodCompany} onChange={(e) => setProdCompany(e.target.value)}>
                <option value="all">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="drawer-field">
              Product Code (SKU)
              <input
                required
                value={prodCode}
                onChange={(e) => setProdCode(e.target.value)}
                placeholder="e.g. SMP-001"
              />
            </label>
            <label className="drawer-field">
              Product Name
              <input
                required
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                placeholder="e.g. Skimmed milk powder"
              />
            </label>
            <label className="drawer-field">
              Category
              <input
                required
                value={prodCategory}
                onChange={(e) => setProdCategory(e.target.value)}
                placeholder="e.g. Dairy"
              />
            </label>
            <label className="drawer-field">
              Unit
              <select
                value={isCustomProdUnit ? "custom" : prodUnit}
                onChange={(e) => {
                  if (e.target.value === "custom") {
                    setIsCustomProdUnit(true);
                    setCustomProdUnit("");
                  } else {
                    setIsCustomProdUnit(false);
                    setProdUnit(e.target.value);
                  }
                }}
              >
                {PRESET_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
                <option value="custom">+ Custom Unit...</option>
              </select>
              {isCustomProdUnit && (
                <div className="mt-1 flex items-center gap-1.5 animate-in fade-in">
                  <input
                    type="text"
                    required
                    value={customProdUnit}
                    onChange={(e) => {
                      setCustomProdUnit(e.target.value);
                      setProdUnit(e.target.value);
                    }}
                    placeholder="e.g. rolls, bundles"
                    className="w-full text-xs font-semibold h-8 px-2.5 rounded border border-primary bg-background focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomProdUnit(false);
                      setProdUnit("kg");
                    }}
                    className="text-[10px] font-bold text-muted-foreground hover:text-foreground px-1.5 py-1 rounded border border-border bg-muted/40 cursor-pointer shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="drawer-field">
                Selling Price (₹) *
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="e.g. 350"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                />
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  Retail / catalog rate
                </span>
              </label>
              <label className="drawer-field">
                Wholesale Price (₹) *
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="e.g. 300"
                  value={prodWholesalePrice}
                  onChange={(e) => setProdWholesalePrice(e.target.value)}
                />
                <span className="text-[10px] text-muted-foreground mt-0.5">Bulk / dealer rate</span>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="drawer-field">
                Initial Stock
                <input
                  type="number"
                  required
                  value={prodOnHand}
                  onChange={(e) => setProdOnHand(e.target.value)}
                />
              </label>
              <label className="drawer-field">
                Min Reorder Level
                <input
                  type="number"
                  required
                  placeholder="e.g. 50"
                  value={prodReorder}
                  onChange={(e) => setProdReorder(e.target.value)}
                />
              </label>
            </div>
            <Button type="submit" className="w-full mt-6">
              Save Product
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* INBOUND STOCK ADJUSTMENT SHEET */}
      <Sheet open={inboundModal} onOpenChange={setInboundModal}>
        <SheetContent className="overflow-y-auto max-h-[100dvh] w-full sm:max-w-lg pb-16">
          <SheetHeader>
            <SheetTitle>Inbound Stock Receipt</SheetTitle>
            <SheetDescription>
              Record received inventory and update minimum reorder threshold
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleInboundStock} className="mt-6 space-y-4 pb-12">
            <label className="drawer-field">
              Select Product
              <select
                value={inboundProductId}
                onChange={(e) => {
                  setInboundProductId(e.target.value);
                  const p = dbProducts.find((x) => x.id === e.target.value);
                  if (p) setInboundReorder(String(p.reorder_level || 20));
                }}
                required
              >
                <option value="">-- Choose Product --</option>
                {dbProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) · Current On-Hand: {p.on_hand} {p.unit}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="drawer-field">
                Inbound Quantity Received
                <input
                  type="number"
                  required
                  min="1"
                  value={inboundQty}
                  onChange={(e) => setInboundQty(e.target.value)}
                  placeholder="50"
                />
              </label>
              <label className="drawer-field">
                Min Reorder Level
                <input
                  type="number"
                  required
                  value={inboundReorder}
                  onChange={(e) => setInboundReorder(e.target.value)}
                  placeholder="20"
                />
              </label>
            </div>
            <label className="drawer-field">
              Inbound Notes / Supplier Reference
              <textarea
                rows={2}
                value={inboundNotes}
                onChange={(e) => setInboundNotes(e.target.value)}
                placeholder="e.g. GRN-9912 received from factory shipment"
              />
            </label>
            <Button type="submit" className="w-full mt-4 font-bold text-xs">
              Confirm Inbound Stock
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* EDIT EXISTING STOCK ADJUSTMENT SHEET */}
      <Sheet open={editStockModal} onOpenChange={setEditStockModal}>
        <SheetContent className="overflow-y-auto max-h-[100dvh] w-full sm:max-w-lg pb-16">
          <SheetHeader>
            <SheetTitle>Edit Existing Stock & Reorder</SheetTitle>
            <SheetDescription>
              Directly edit the on-hand quantity, minimum reorder threshold, and unit price for this
              product
            </SheetDescription>
          </SheetHeader>

          {editStockProduct && (
            <form onSubmit={handleUpdateStock} className="mt-6 space-y-4 pb-12">
              {/* Product Info Banner */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-sm">{editStockProduct.name}</span>
                  <span className="eyebrow !text-[9px]">{editStockProduct.code}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {companies.find((c) => c.id === editStockProduct.company_id)?.name ||
                      "All Companies"}
                  </span>
                  <span>Category: {editStockProduct.category}</span>
                </div>
                {(() => {
                  const outbound = outboundOrderedQuantity(dbOrders, editStockProduct);
                  if (outbound <= 0) return null;
                  return (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium pt-1 border-t border-border/50">
                      ⚠️ {outbound} {editStockProduct.unit} outbound on active orders
                    </p>
                  );
                })()}
              </div>

              {/* Product Selector to switch products inside the drawer */}
              <label className="drawer-field">
                Select Product to Edit
                <select
                  value={editStockProduct.id}
                  onChange={(e) => {
                    const selected = dbProducts.find((p) => p.id === e.target.value);
                    if (selected) openEditStock(selected);
                  }}
                >
                  {dbProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code}) · Current: {p.on_hand} {p.unit}
                    </option>
                  ))}
                </select>
              </label>

              {/* On-Hand Stock Input with live delta */}
              <div className="space-y-1.5">
                <label className="drawer-field">
                  Physical On-Hand Stock Quantity ({editStockUnit})
                  <input
                    type="number"
                    step="any"
                    required
                    min="0"
                    value={editStockOnHand}
                    onChange={(e) => setEditStockOnHand(e.target.value)}
                    placeholder="e.g. 150"
                  />
                </label>
                {(() => {
                  const current = Number(editStockProduct.on_hand) || 0;
                  const entered = parseFloat(editStockOnHand);
                  if (isNaN(entered)) return null;
                  const delta = entered - current;
                  const outbound = outboundOrderedQuantity(dbOrders, editStockProduct);
                  const resultingAvail = Math.max(0, availableFromStock(entered, outbound));
                  return (
                    <div className="p-2.5 rounded-lg bg-card border border-border/70 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">
                          Previous on-hand: {current} {editStockUnit}
                        </span>
                        <span className="text-muted-foreground block text-[10px]">
                          Resulting available:{" "}
                          <strong className="text-foreground">
                            {resultingAvail} {editStockUnit}
                          </strong>
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                          delta > 0
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : delta < 0
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {delta > 0 ? `+${delta}` : delta} {editStockUnit}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Selling Price & Wholesale Price */}
              <div className="grid grid-cols-2 gap-3">
                <label className="drawer-field">
                  Selling Price (₹) *
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={editStockUnitPrice}
                    onChange={(e) => setEditStockUnitPrice(e.target.value)}
                    placeholder="e.g. 350"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    Retail / catalog rate
                  </span>
                </label>
                <label className="drawer-field">
                  Wholesale Price (₹) *
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={editStockWholesalePrice}
                    onChange={(e) => setEditStockWholesalePrice(e.target.value)}
                    placeholder="e.g. 300"
                  />
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    Bulk / dealer rate
                  </span>
                </label>
              </div>

              {/* Min Reorder Level */}
              <label className="drawer-field">
                Min Reorder Level
                <input
                  type="number"
                  step="any"
                  required
                  min="0"
                  value={editStockReorder}
                  onChange={(e) => setEditStockReorder(e.target.value)}
                  placeholder="20"
                />
              </label>

              {/* Unit of measure */}
              <label className="drawer-field">
                Unit of Measure
                <select
                  value={isCustomEditStockUnit ? "custom" : editStockUnit}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setIsCustomEditStockUnit(true);
                      setCustomEditStockUnit("");
                    } else {
                      setIsCustomEditStockUnit(false);
                      setEditStockUnit(e.target.value);
                    }
                  }}
                >
                  {PRESET_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                  <option value="custom">+ Custom Unit...</option>
                </select>
                {isCustomEditStockUnit && (
                  <div className="mt-1 flex items-center gap-1.5 animate-in fade-in">
                    <input
                      type="text"
                      required
                      value={customEditStockUnit}
                      onChange={(e) => {
                        setCustomEditStockUnit(e.target.value);
                        setEditStockUnit(e.target.value);
                      }}
                      placeholder="e.g. rolls, bundles"
                      className="w-full text-xs font-semibold h-8 px-2.5 rounded border border-primary bg-background focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomEditStockUnit(false);
                        setEditStockUnit("kg");
                      }}
                      className="text-[10px] font-bold text-muted-foreground hover:text-foreground px-1.5 py-1 rounded border border-border bg-muted/40 cursor-pointer shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </label>

              {/* Adjustment Reason */}
              <label className="drawer-field">
                Reason for Stock Edit
                <select
                  value={editStockReason}
                  onChange={(e) => setEditStockReason(e.target.value)}
                >
                  <option value="Physical inventory recount / audit">
                    Physical inventory recount / audit
                  </option>
                  <option value="Correction of initial entry mistake">
                    Correction of initial entry mistake
                  </option>
                  <option value="Damaged / expired goods written off">
                    Damaged / expired goods written off
                  </option>
                  <option value="Discrepancy found during warehouse check">
                    Discrepancy found during warehouse check
                  </option>
                  <option value="Customer return restocked">Customer return restocked</option>
                  <option value="Supplier goods reconciliation">
                    Supplier goods reconciliation
                  </option>
                  <option value="Other / Custom reason">Other / Custom reason</option>
                </select>
              </label>

              {/* Specific Notes */}
              <label className="drawer-field">
                Audit Notes / Remarks
                <textarea
                  rows={2}
                  value={editStockNotes}
                  onChange={(e) => setEditStockNotes(e.target.value)}
                  placeholder="Optional details, e.g. Recounted by store manager, batch discrepancy corrected"
                />
              </label>

              <div className="flex items-center gap-3 pt-3">
                <Button type="submit" className="flex-1 cursor-pointer font-bold text-xs">
                  Save Stock Updates
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 cursor-pointer text-xs"
                  onClick={() => setEditStockModal(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* CUSTOMER DETAILS DOSSIER SHEET */}
      <Sheet
        open={!!selectedCustomerDetails}
        onOpenChange={(open) => !open && setSelectedCustomerDetails(null)}
      >
        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto max-h-screen p-6 sm:p-8">
          <SheetHeader className="pb-4 border-b border-border/70">
            <div className="flex items-start justify-between gap-4 pr-6">
              <div className="flex items-center gap-3.5 min-w-0">
                <span className="avatar size-12 text-sm font-bold shrink-0 bg-primary/10 text-primary border border-primary/20">
                  {selectedCustomerDetails?.initials}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SheetTitle className="text-xl font-bold truncate">
                      {selectedCustomerDetails?.name}
                    </SheetTitle>
                    <span className="status success text-xs font-semibold py-0.5 px-2.5">
                      {selectedCustomerDetails?.status}
                    </span>
                  </div>
                  <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                    {companies.find((c) => c.id === selectedCustomerDetails?.company_id)?.name ||
                      "Avighna Group"}{" "}
                    · Customer ID {selectedCustomerDetails?.id || "—"} ·{" "}
                    {Number(selectedCustomerDetails?.credit_days) || 30} credit days
                  </SheetDescription>
                </div>
              </div>
            </div>
          </SheetHeader>

          {selectedCustomerDetails && (
            <div className="mt-5 space-y-5">
              {/* Primary Action Bar */}
              <div className="flex items-center gap-3 flex-wrap pb-2 border-b border-border/40">
                <Button
                  size="sm"
                  className="h-9 px-3.5 text-xs font-semibold cursor-pointer shadow-xs gap-1.5"
                  onClick={() => {
                    const cust = selectedCustomerDetails;
                    if (!cust) return;
                    setSelectedCustomerDetails(null);
                    navigateToCreateOrder({
                      customerName: cust.name,
                      companyId: cust.company_id,
                      notes: `Direct order created for ${cust.name}`,
                    });
                  }}
                >
                  <Plus className="size-3.5" />
                  New Order
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 px-3.5 text-xs font-semibold hover:border-primary cursor-pointer shadow-xs gap-1.5 bg-background text-foreground"
                  onClick={() => {
                    if (selectedCustomerDetails) openEditCustomer(selectedCustomerDetails);
                  }}
                >
                  <Pencil className="size-3.5 text-primary" />
                  Edit Profile
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 px-3.5 text-xs font-semibold hover:border-primary cursor-pointer shadow-xs gap-1.5 bg-background text-foreground"
                  onClick={() => {
                    const cust = selectedCustomerDetails;
                    setSelectedCustomerDetails(null);
                    setVisitFirm(cust.company_id);
                    setVisitSelectedCustomer(cust.name);
                    setTab("Log a visit");
                  }}
                >
                  <MapPin className="size-3.5 text-muted-foreground" />
                  Log Visit
                </Button>

                {isSuperAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 px-3 text-xs font-semibold text-destructive hover:bg-destructive/10 cursor-pointer ml-auto gap-1.5"
                    onClick={() => {
                      const cust = selectedCustomerDetails;
                      if (!cust) return;
                      setDeleteTarget({
                        type: "Customer Account",
                        id: cust.id || cust.name,
                        name: cust.name,
                        onDelete: async () => {
                          await deleteCustomer(cust.id || cust.name, currentUser?.name);
                          setDbCustomers((prev) =>
                            prev.filter((x) => (x.id || x.name) !== (cust.id || cust.name)),
                          );
                          setSelectedCustomerDetails(null);
                        },
                      });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </Button>
                )}
              </div>

              {/* Contact Information & Profile Card */}
              {(() => {
                const dossierLead = dbLeads.find(
                  (l) =>
                    l.converted_customer_id === selectedCustomerDetails.id ||
                    (l.business_name &&
                      l.business_name.toLowerCase() ===
                        selectedCustomerDetails.name.toLowerCase()) ||
                    (l.contact_person &&
                      selectedCustomerDetails.contact_person &&
                      l.contact_person.toLowerCase() ===
                        selectedCustomerDetails.contact_person.toLowerCase()),
                );
                const dispPhone = selectedCustomerDetails.phone || dossierLead?.phone || "";
                const dispEmail = selectedCustomerDetails.email || dossierLead?.email || "";
                const dispAddress = selectedCustomerDetails.address || dossierLead?.city || "";
                const dispContact =
                  selectedCustomerDetails.contact_person || dossierLead?.contact_person || "";
                const dispNotes =
                  selectedCustomerDetails.notes ||
                  (dossierLead
                    ? [
                        dossierLead.requirement ? `Requirement: ${dossierLead.requirement}` : "",
                        dossierLead.source ? `Source: ${dossierLead.source}` : "",
                        dossierLead.gstin ? `GSTIN: ${dossierLead.gstin}` : "",
                        dossierLead.notes ? `Lead notes: ${dossierLead.notes}` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : "");

                return (
                  <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card space-y-4 shadow-xs">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-primary" /> Contact & Company Details
                      </h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 cursor-pointer"
                        onClick={() => openEditCustomer(selectedCustomerDetails)}
                      >
                        <Pencil className="size-3 mr-1" /> Edit
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Contact Person */}
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <span className="text-muted-foreground block text-[11px] font-medium flex items-center gap-1.5 mb-1">
                          <Users className="size-3.5 text-primary" /> Contact Person
                        </span>
                        {dispContact ? (
                          <span className="font-bold text-foreground text-sm">{dispContact}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEditCustomer(selectedCustomerDetails)}
                            className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline cursor-pointer"
                          >
                            + Add Contact Person
                          </button>
                        )}
                      </div>

                      {/* Phone Number */}
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1.5">
                            <Phone className="size-3.5 text-primary" /> Phone Number
                          </span>
                          {dispPhone && (
                            <button
                              type="button"
                              onClick={() => handleCopy(dispPhone, "phone")}
                              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                              title="Copy phone"
                            >
                              <Copy className="size-2.5" />
                              {copiedField === "phone" ? "Copied" : "Copy"}
                            </button>
                          )}
                        </div>
                        {dispPhone ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <a
                              href={`tel:${dispPhone}`}
                              className="font-bold text-foreground hover:text-primary text-sm font-mono whitespace-nowrap"
                            >
                              {dispPhone}
                            </a>
                            <a
                              href={`https://wa.me/${dispPhone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-500/20 whitespace-nowrap"
                            >
                              WhatsApp
                            </a>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEditCustomer(selectedCustomerDetails)}
                            className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline cursor-pointer"
                          >
                            + Add Phone Number
                          </button>
                        )}
                      </div>

                      {/* Email Address */}
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1.5">
                            <Mail className="size-3.5 text-primary" /> Email Address
                          </span>
                          {dispEmail && (
                            <button
                              type="button"
                              onClick={() => handleCopy(dispEmail, "email")}
                              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                              title="Copy email"
                            >
                              <Copy className="size-2.5" />
                              {copiedField === "email" ? "Copied" : "Copy"}
                            </button>
                          )}
                        </div>
                        {dispEmail ? (
                          <a
                            href={`mailto:${dispEmail}`}
                            className="font-semibold text-foreground hover:text-primary text-xs truncate block"
                            title={dispEmail}
                          >
                            {dispEmail}
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openEditCustomer(selectedCustomerDetails)}
                            className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline cursor-pointer"
                          >
                            + Add Email Address
                          </button>
                        )}
                      </div>

                      {/* Company / Entity */}
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <span className="text-muted-foreground block text-[11px] font-medium flex items-center gap-1.5 mb-1">
                          <Building2 className="size-3.5 text-primary" /> Operating Company
                        </span>
                        <span className="font-semibold text-foreground text-xs block">
                          {companies.find((c) => c.id === selectedCustomerDetails.company_id)
                            ?.name || "Avighna Group"}
                        </span>
                      </div>
                    </div>

                    {/* Full Address */}
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1.5">
                          <MapPin className="size-3.5 text-primary" /> Billing / Delivery Address
                        </span>
                        {dispAddress && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(dispAddress, "address")}
                              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                              title="Copy address"
                            >
                              <Copy className="size-2.5" />
                              {copiedField === "address" ? "Copied" : "Copy"}
                            </button>
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(dispAddress)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-primary hover:underline flex items-center gap-0.5 font-semibold"
                            >
                              <ExternalLink className="size-2.5" /> Maps
                            </a>
                          </div>
                        )}
                      </div>
                      {dispAddress ? (
                        <p className="font-medium text-foreground text-xs whitespace-pre-line leading-relaxed">
                          {dispAddress}
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openEditCustomer(selectedCustomerDetails)}
                          className="text-xs text-amber-600 dark:text-amber-400 font-semibold hover:underline cursor-pointer"
                        >
                          + Add Address
                        </button>
                      )}
                    </div>

                    {/* Notes & Commercial Terms - Distinct Separate Cards */}
                    {(() => {
                      const commercialItems: { label: string; value: string }[] = [];
                      const knownKeys = new Set<string>();

                      // Parse pieces from dispNotes separated by · or \n
                      if (dispNotes) {
                        const rawParts = dispNotes.split(/\s*[·\n]\s*/).filter(Boolean);
                        rawParts.forEach((part) => {
                          let clean = part.trim();
                          if (!clean) return;

                          // Handle "Requirement: Product Interest: Skimmed Milk Powder."
                          if (clean.toLowerCase().startsWith("requirement: product interest:")) {
                            clean = clean.replace(
                              /^requirement:\s*product interest:\s*/i,
                              "Product Interest: ",
                            );
                          } else if (clean.toLowerCase().startsWith("requirement:")) {
                            clean = clean.replace(/^requirement:\s*/i, "");
                          }

                          const match = clean.match(/^([A-Za-z0-9\s()&/-]+?):\s*(.+)$/);
                          if (match && match[1] && match[2]) {
                            let key = match[1].trim();
                            const val = match[2].trim().replace(/\.$/, "");

                            // Normalize key names
                            const keyLower = key.toLowerCase();
                            if (keyLower === "est") key = "Estimated Value";
                            else if (keyLower === "notes" || keyLower === "lead notes")
                              key = "Notes & Specs";
                            else if (keyLower === "city") key = "City / Region";
                            else if (keyLower === "type") key = "Customer Type";
                            else if (keyLower === "expected") key = "Expected Volume";
                            else if (keyLower === "priority") key = "Priority Level";
                            else if (keyLower === "source") key = "Lead Source";

                            if (!knownKeys.has(key.toLowerCase())) {
                              knownKeys.add(key.toLowerCase());
                              commercialItems.push({ label: key, value: val });
                            }
                          } else {
                            commercialItems.push({ label: "Special Requirement", value: clean });
                          }
                        });
                      }

                      // Supplement from dossierLead if not yet added
                      if (dossierLead) {
                        if (dossierLead.product_interest && !knownKeys.has("product interest")) {
                          commercialItems.unshift({
                            label: "Product Interest",
                            value: dossierLead.product_interest,
                          });
                          knownKeys.add("product interest");
                        }
                        if (dossierLead.estimated_value && !knownKeys.has("estimated value")) {
                          commercialItems.push({
                            label: "Estimated Value",
                            value: `₹${Number(dossierLead.estimated_value).toLocaleString("en-IN")}`,
                          });
                          knownKeys.add("estimated value");
                        }
                        if (
                          dossierLead.priority &&
                          !knownKeys.has("priority level") &&
                          !knownKeys.has("priority")
                        ) {
                          commercialItems.push({
                            label: "Priority Level",
                            value: dossierLead.priority,
                          });
                          knownKeys.add("priority level");
                        }
                        if (
                          dossierLead.source &&
                          !knownKeys.has("lead source") &&
                          !knownKeys.has("source")
                        ) {
                          commercialItems.push({
                            label: "Lead Source",
                            value: dossierLead.source,
                          });
                          knownKeys.add("lead source");
                        }
                        if (
                          dossierLead.expected_quantity &&
                          !knownKeys.has("expected volume") &&
                          !knownKeys.has("expected")
                        ) {
                          commercialItems.push({
                            label: "Expected Volume",
                            value: dossierLead.expected_quantity,
                          });
                          knownKeys.add("expected volume");
                        }
                        if (dossierLead.gstin && !knownKeys.has("gstin")) {
                          commercialItems.push({ label: "GSTIN", value: dossierLead.gstin });
                          knownKeys.add("gstin");
                        }
                      }

                      return (
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground block text-[11px] font-bold uppercase tracking-wider">
                              Commercial Notes & Requirements
                            </span>
                            <button
                              type="button"
                              onClick={() => openEditCustomer(selectedCustomerDetails)}
                              className="text-[11px] text-primary font-semibold hover:underline cursor-pointer"
                            >
                              {commercialItems.length > 0 ? "Edit Details" : "+ Add Details"}
                            </button>
                          </div>

                          {commercialItems.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {commercialItems.map((item, idx) => {
                                const isEst = item.label.toLowerCase().includes("est");
                                const isProduct = item.label.toLowerCase().includes("product");
                                const isLong = item.value.length > 35;
                                return (
                                  <div
                                    key={idx}
                                    className={`p-3 rounded-xl border transition-colors ${
                                      isLong ? "sm:col-span-2" : ""
                                    } ${
                                      isProduct
                                        ? "bg-primary/5 border-primary/25 shadow-2xs"
                                        : isEst
                                          ? "bg-emerald-500/5 border-emerald-500/25 shadow-2xs"
                                          : "bg-muted/30 border-border/60"
                                    }`}
                                  >
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                                      {item.label}
                                    </span>
                                    <p
                                      className={`font-bold text-xs ${
                                        isEst
                                          ? "text-emerald-600 dark:text-emerald-400 font-mono text-sm"
                                          : isProduct
                                            ? "text-primary text-sm"
                                            : "text-foreground"
                                      }`}
                                    >
                                      {item.value}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl bg-muted/20 border border-dashed border-border/60 text-xs flex items-center justify-between">
                              <span className="text-muted-foreground text-[11px]">
                                No commercial notes or special requirements recorded.
                              </span>
                              <button
                                type="button"
                                onClick={() => openEditCustomer(selectedCustomerDetails)}
                                className="text-xs text-primary font-semibold hover:underline cursor-pointer"
                              >
                                + Add Notes
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}

              {(() => {
                const cust = selectedCustomerDetails;
                const same = (rec: { customer_id?: string | null; customer_name?: string }) =>
                  Boolean(
                    (cust.id && rec.customer_id === cust.id) ||
                      rec.customer_name?.trim().toLowerCase() === cust.name.trim().toLowerCase(),
                  );
                const invoices = dbInvoices.filter(same);
                const invoiceIds = new Set(invoices.map((i) => i.id));
                const payments = dbPayments.filter(
                  (p) => (cust.id && p.customer_id === cust.id) || invoiceIds.has(p.invoice_id),
                );
                const outstanding = invoices.reduce(
                  (sum, inv) => sum + (Number(inv.remaining_amount) || 0),
                  0,
                );
                const billed = invoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
                const paid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                return (
                  <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card space-y-3 shadow-xs">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <CreditCard className="size-3.5 text-primary" /> Account & credit
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <span className="text-[11px] text-muted-foreground block">Outstanding</span>
                        <span className="font-bold">{money(outstanding)}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <span className="text-[11px] text-muted-foreground block">Credit days</span>
                        <span className="font-bold">{Number(cust.credit_days) || 30}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <span className="text-[11px] text-muted-foreground block">Billed</span>
                        <span className="font-bold">{money(billed)}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                        <span className="text-[11px] text-muted-foreground block">Paid</span>
                        <span className="font-bold">{money(paid)}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Invoices ({invoices.length})
                      </p>
                      {invoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="p-3 rounded-xl border border-border/80 bg-background text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold">{inv.id}</span>
                            <span className="status brand text-[11px]">{inv.status}</span>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {inv.created_at?.split("T")[0] || "—"} · {money(Number(inv.amount) || 0)}{" "}
                            · due {inv.due_date || "—"} · outstanding{" "}
                            {money(Number(inv.remaining_amount) || 0)}
                          </p>
                        </div>
                      ))}
                      {invoices.length === 0 && (
                        <p className="text-xs text-muted-foreground py-2 text-center">
                          No invoices yet.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Payments ({payments.length})
                      </p>
                      {payments.map((p) => (
                        <div
                          key={p.id || `${p.invoice_id}-${p.amount}`}
                          className="p-3 rounded-xl border border-border/80 bg-background text-xs"
                        >
                          <span className="font-bold">{money(Number(p.amount) || 0)}</span>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {p.created_at?.split("T")[0] || "—"} · {p.payment_method} · {p.invoice_id}
                          </p>
                        </div>
                      ))}
                      {payments.length === 0 && (
                        <p className="text-xs text-muted-foreground py-2 text-center">
                          No payments recorded.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Order History */}
              <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <ShoppingBag className="size-3.5 text-primary" />
                    Sales Orders (
                    {
                      dbOrders.filter(
                        (o) =>
                          (selectedCustomerDetails.id &&
                            o.customer_id === selectedCustomerDetails.id) ||
                          o.customer_name.trim().toLowerCase() ===
                            selectedCustomerDetails.name.trim().toLowerCase(),
                      ).length
                    }
                    )
                  </h4>
                </div>
                <div className="space-y-2">
                  {dbOrders
                    .filter(
                      (o) =>
                        (selectedCustomerDetails.id &&
                          o.customer_id === selectedCustomerDetails.id) ||
                        o.customer_name.trim().toLowerCase() ===
                          selectedCustomerDetails.name.trim().toLowerCase(),
                    )
                    .map((o) => (
                      <div
                        key={o.id}
                        className="p-3 rounded-xl border border-border/80 bg-background flex items-center justify-between text-xs hover:border-primary/40 transition-colors"
                      >
                        <div>
                          <p className="font-bold text-foreground">Order #{o.id}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {o.created_at?.split("T")[0]} · {money(o.total_amount)}
                          </p>
                        </div>
                        <span className="status brand text-[11px] font-semibold">{o.status}</span>
                      </div>
                    ))}
                  {dbOrders.filter(
                    (o) =>
                      (selectedCustomerDetails.id && o.customer_id === selectedCustomerDetails.id) ||
                      o.customer_name.trim().toLowerCase() ===
                        selectedCustomerDetails.name.trim().toLowerCase(),
                  ).length === 0 && (
                    <p className="text-xs text-muted-foreground py-3 text-center bg-muted/20 rounded-xl">
                      No orders placed yet.
                    </p>
                  )}
                </div>
              </div>

              {/* Field Visits History */}
              <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card space-y-3 shadow-xs">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <MapPin className="size-3.5 text-primary" />
                  Field Visits Conducted (
                  {
                    visibleFieldVisits.filter(
                      (v) => v.customer_name === selectedCustomerDetails.name,
                    ).length
                  }
                  )
                </h4>
                <div className="space-y-2">
                  {visibleFieldVisits
                    .filter((v) => v.customer_name === selectedCustomerDetails.name)
                    .map((v) => (
                      <div
                        key={v.id || v.customer_name}
                        className="p-3 rounded-xl border border-border/80 bg-background space-y-1 text-xs hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">{v.purpose}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {v.scheduled_date}
                          </span>
                        </div>
                        {v.outcome_notes && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                            {v.outcome_notes}
                          </p>
                        )}
                      </div>
                    ))}
                  {visibleFieldVisits.filter(
                    (v) => v.customer_name === selectedCustomerDetails.name,
                  ).length === 0 && (
                    <p className="text-xs text-muted-foreground py-3 text-center bg-muted/20 rounded-xl">
                      No field visits on record.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* VOICE MEMO AUDIO PLAYER DIALOG */}
      <Sheet
        open={!!selectedVisitAudio}
        onOpenChange={(open) => {
          if (!open) {
            stopCurrentAudio();
            setSelectedVisitAudio(null);
          }
        }}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Volume2 className="size-5 text-primary" />
              <span>Voice Memo Briefing</span>
            </SheetTitle>
            <SheetDescription>
              {selectedVisitAudio?.customer_name} · Recorded by{" "}
              {selectedVisitAudio?.assigned_to_name}
            </SheetDescription>
          </SheetHeader>

          {selectedVisitAudio && (
            <div className="mt-6 space-y-6">
              {/* Playback Cockpit */}
              <div className="p-6 rounded-2xl bg-card border border-border shadow-xs text-center space-y-4">
                <div className="size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-inner">
                  {isPlayingAudio ? (
                    <Volume2 className="size-8 animate-pulse text-primary" />
                  ) : (
                    <Volume2 className="size-8 text-muted-foreground" />
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-black text-foreground">
                    {selectedVisitAudio.purpose}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedVisitAudio.scheduled_date} · {selectedVisitAudio.scheduled_time}
                  </p>
                </div>

                {/* Animated Waveform Visualization */}
                <div className="flex items-center justify-center gap-1.5 h-12 py-2">
                  {[35, 75, 45, 90, 60, 80, 50, 95, 40, 70, 85, 55, 65, 90, 40].map((h, i) => (
                    <span
                      key={i}
                      className={`w-1 rounded-full transition-all duration-300 ${
                        isPlayingAudio ? "bg-primary animate-pulse" : "bg-muted-foreground/30"
                      }`}
                      style={{
                        height: isPlayingAudio
                          ? `${Math.max(20, (h * ((audioTimer % 4) + 1)) / 3.5)}%`
                          : `${h * 0.35}%`,
                      }}
                    />
                  ))}
                </div>

                <div className="text-xs font-mono font-bold text-muted-foreground">
                  00:{audioTimer < 10 ? `0${audioTimer}` : audioTimer} / 00:
                  {audioTotalDuration < 10 ? `0${audioTotalDuration}` : audioTotalDuration}
                </div>

                <div className="space-y-2 pt-1">
                  <Button
                    onClick={() => {
                      if (isPlayingAudio) {
                        stopCurrentAudio();
                      } else {
                        playAudioMemo(selectedVisitAudio);
                      }
                    }}
                    className="w-full h-11 font-bold text-xs cursor-pointer"
                  >
                    {isPlayingAudio ? (
                      <>
                        <Pause className="size-4 mr-2" /> Pause Audio
                      </>
                    ) : (
                      <>
                        <Play className="size-4 mr-2" /> Play Voice Memo
                      </>
                    )}
                  </Button>

                  {/* Native Audio Controls for direct browser playback & seeking */}
                  {selectedVisitAudio.voice_recording_path &&
                    (selectedVisitAudio.voice_recording_path.startsWith("data:audio") ||
                      selectedVisitAudio.voice_recording_path.startsWith("http") ||
                      selectedVisitAudio.voice_recording_path.startsWith("blob:")) && (
                      <div className="pt-2">
                        <audio
                          controls
                          src={selectedVisitAudio.voice_recording_path}
                          className="w-full h-9 rounded-lg"
                        />
                      </div>
                    )}
                </div>
              </div>

              {/* Briefing Summary */}
              {selectedVisitAudio.outcome_notes && (
                <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-1.5 text-xs">
                  <span className="font-bold text-foreground block">
                    Discussion Transcript / Summary:
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    {selectedVisitAudio.outcome_notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* PHOTO LIGHTBOX MODAL */}
      {selectedVisitPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setSelectedVisitPhoto(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-background rounded-2xl overflow-hidden shadow-2xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-border bg-card">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Camera className="size-4 text-primary" /> On-site Field Verification Photo
              </span>
              <button
                type="button"
                onClick={() => setSelectedVisitPhoto(null)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-2 max-h-[80vh] overflow-auto flex items-center justify-center">
              <img
                src={selectedVisitPhoto}
                alt="Enlarged Proof"
                className="max-h-[75vh] w-auto rounded-lg object-contain"
                onError={(e) => {
                  if (e.currentTarget.src !== FALLBACK_PROOF_IMAGE) {
                    e.currentTarget.src = FALLBACK_PROOF_IMAGE;
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* PO CREATION SHEET */}
      <Sheet open={poModal} onOpenChange={setPoModal}>
        <SheetContent className="overflow-y-auto max-h-[100dvh] w-full sm:max-w-lg pb-16">
          <SheetHeader>
            <SheetTitle>Create Purchase Order</SheetTitle>
            <SheetDescription>Inbound procurement from supplier</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleCreatePO} className="mt-6 space-y-4 pb-12">
            <label className="drawer-field">
              Company
              <select value={poCompany} onChange={(e) => setPoCompany(e.target.value)}>
                <option value="all">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="drawer-field">
              Supplier Name
              <input
                required
                value={poSupplier}
                onChange={(e) => setPoSupplier(e.target.value)}
                placeholder="e.g. Apex Dairy Suppliers Ltd"
              />
            </label>
            <label className="drawer-field">
              Product Name
              <input
                required
                value={poProduct}
                onChange={(e) => setPoProduct(e.target.value)}
                placeholder="Product name"
              />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="drawer-field">
                Quantity
                <input
                  type="number"
                  required
                  value={poQuantity}
                  onChange={(e) => setPoQuantity(e.target.value)}
                />
              </label>
              <label className="drawer-field">
                Unit
                <select
                  value={isCustomPoUnit ? "custom" : poUnit}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setIsCustomPoUnit(true);
                      setCustomPoUnit("");
                    } else {
                      setIsCustomPoUnit(false);
                      setPoUnit(e.target.value);
                    }
                  }}
                >
                  {PRESET_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                  <option value="custom">+ Custom Unit...</option>
                </select>
                {isCustomPoUnit && (
                  <div className="mt-1 flex items-center gap-1.5 animate-in fade-in">
                    <input
                      type="text"
                      required
                      value={customPoUnit}
                      onChange={(e) => {
                        setCustomPoUnit(e.target.value);
                        setPoUnit(e.target.value);
                      }}
                      placeholder="e.g. rolls, bundles"
                      className="w-full text-xs font-semibold h-8 px-2.5 rounded border border-primary bg-background focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomPoUnit(false);
                        setPoUnit("kg");
                      }}
                      className="text-[10px] font-bold text-muted-foreground hover:text-foreground px-1.5 py-1 rounded border border-border bg-muted/40 cursor-pointer shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </label>
              <label className="drawer-field">
                Unit Price
                <input
                  type="number"
                  required
                  value={poPrice}
                  onChange={(e) => setPoPrice(e.target.value)}
                />
              </label>
            </div>
            <Button type="submit" className="w-full mt-6">
              Submit Purchase Order
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* EDIT PURCHASE ORDER SHEET (Super Admin & Supervisor) */}
      <Sheet open={editPoModal} onOpenChange={setEditPoModal}>
        <SheetContent className="overflow-y-auto max-h-[100dvh] w-full sm:max-w-lg pb-16">
          <SheetHeader>
            <SheetTitle>Edit Purchase Order</SheetTitle>
            <SheetDescription>Modify procurement details for PO #{editingPo?.id}</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleUpdatePO} className="mt-6 space-y-4 pb-12">
            <label className="drawer-field">
              Company
              <select value={editPoCompany} onChange={(e) => setEditPoCompany(e.target.value)}>
                <option value="all">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="drawer-field">
              Supplier Name
              <input
                required
                value={editPoSupplier}
                onChange={(e) => setEditPoSupplier(e.target.value)}
                placeholder="e.g. Apex Dairy Suppliers Ltd"
              />
            </label>
            <label className="drawer-field">
              Product Name
              <input
                required
                value={editPoProduct}
                onChange={(e) => setEditPoProduct(e.target.value)}
                placeholder="Product name"
              />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="drawer-field">
                Quantity
                <input
                  type="number"
                  required
                  value={editPoQuantity}
                  onChange={(e) => setEditPoQuantity(e.target.value)}
                />
              </label>
              <label className="drawer-field">
                Unit
                <select
                  value={isCustomEditPoUnit ? "custom" : editPoUnit}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setIsCustomEditPoUnit(true);
                      setCustomEditPoUnit("");
                    } else {
                      setIsCustomEditPoUnit(false);
                      setEditPoUnit(e.target.value);
                    }
                  }}
                >
                  {PRESET_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                  <option value="custom">+ Custom Unit...</option>
                </select>
                {isCustomEditPoUnit && (
                  <div className="mt-1 flex items-center gap-1.5 animate-in fade-in">
                    <input
                      type="text"
                      required
                      value={customEditPoUnit}
                      onChange={(e) => {
                        setCustomEditPoUnit(e.target.value);
                        setEditPoUnit(e.target.value);
                      }}
                      placeholder="e.g. rolls, bundles"
                      className="w-full text-xs font-semibold h-8 px-2.5 rounded border border-primary bg-background focus:ring-1 focus:ring-primary"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomEditPoUnit(false);
                        setEditPoUnit("kg");
                      }}
                      className="text-[10px] font-bold text-muted-foreground hover:text-foreground px-1.5 py-1 rounded border border-border bg-muted/40 cursor-pointer shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </label>
              <label className="drawer-field">
                Unit Price
                <input
                  type="number"
                  required
                  value={editPoPrice}
                  onChange={(e) => setEditPoPrice(e.target.value)}
                />
              </label>
            </div>
            <label className="drawer-field">
              Status
              <select
                value={editPoStatus}
                onChange={(e) => setEditPoStatus(e.target.value as "Requested" | "Received")}
              >
                <option value="Requested">Requested</option>
                <option value="Received">Received</option>
              </select>
            </label>
            <Button type="submit" className="w-full mt-6">
              Save Changes
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* EDIT FIELD VISIT SHEET (1-Time Sales Edit or Admin/Supervisor Edit) */}
      <Sheet open={editVisitModal} onOpenChange={setEditVisitModal}>
        <SheetContent className="overflow-y-auto max-h-[100dvh] w-full sm:max-w-lg pb-16">
          <SheetHeader>
            <SheetTitle>Edit Field Visit Log</SheetTitle>
            <SheetDescription>
              {editingVisit?.customer_name} ·{" "}
              {currentUser?.role === "sales"
                ? "Sales team members are permitted to modify this visit log once."
                : "Update logged outcome, visit date and time."}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleUpdateVisit} className="mt-6 space-y-4 pb-12">
            <div className="grid grid-cols-2 gap-3">
              <label className="drawer-field">
                Visit Date
                <input
                  type="date"
                  required
                  value={editVisitDate}
                  onChange={(e) => setEditVisitDate(e.target.value)}
                />
              </label>
              <label className="drawer-field">
                Visit Time
                <input
                  type="time"
                  required
                  value={editVisitTime}
                  onChange={(e) => setEditVisitTime(e.target.value)}
                />
              </label>
            </div>
            <label className="drawer-field">
              Mission / Purpose
              <select
                value={editVisitPurpose}
                onChange={(e) => setEditVisitPurpose(e.target.value)}
              >
                {[
                  "Follow-up",
                  "Order booking",
                  "Payment collection",
                  "Sample delivery",
                  "Complaint resolution",
                  "New client pitch",
                ].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="drawer-field">
              Discussion Notes & Outcome
              <textarea
                rows={4}
                required
                value={editVisitNotes}
                onChange={(e) => setEditVisitNotes(e.target.value)}
                placeholder="Update discussion outcome, requirements, customer feedback..."
                className="w-full text-xs font-medium p-3 rounded-lg border border-border bg-background resize-none focus:border-primary focus:ring-1 focus:ring-primary leading-relaxed"
              />
            </label>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300">
              <p className="font-semibold flex items-center gap-1.5">
                <Lock className="size-3.5 shrink-0" />
                <span>Notice on One-Time Edit Policy</span>
              </p>
              <p className="mt-1 text-[11px] leading-relaxed">
                {currentUser?.role === "sales"
                  ? "Saving changes will record your final 1-time modification. Subsequent edits will be locked for security and audit integrity."
                  : "Changes will update the field visit record and log an audit timestamp."}
              </p>
            </div>
            <Button type="submit" className="w-full mt-4">
              Save Visit Changes
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* FIELD VISIT SHEET */}
      <Sheet open={visitModal} onOpenChange={setVisitModal}>
        <SheetContent className="overflow-y-auto max-h-[100dvh] w-full sm:max-w-lg pb-16">
          <SheetHeader>
            <SheetTitle>Schedule Field Visit</SheetTitle>
            <SheetDescription>Assign on-site client visit to representative</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleScheduleVisit} className="mt-6 space-y-4 pb-12">
            <label className="drawer-field">
              Company
              <select value={visitFirm} onChange={(e) => setVisitFirm(e.target.value)}>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="drawer-field">
              Customer Name
              <input
                required
                value={visitCustomer}
                onChange={(e) => setVisitCustomer(e.target.value)}
                placeholder="Customer to visit"
              />
            </label>
            <label className="drawer-field">
              Purpose
              <select value={visitPurpose} onChange={(e) => setVisitPurpose(e.target.value)}>
                <option>Follow-up</option>
                <option>Collection</option>
                <option>New order</option>
                <option>Sample demo</option>
              </select>
            </label>
            <label className="drawer-field">
              Date
              <input
                type="date"
                required
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </label>
            <label className="drawer-field">
              Time
              <input
                required
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
                placeholder="10:00 AM"
              />
            </label>
            <Button type="submit" className="w-full mt-6">
              Schedule Visit
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* ORDER DESK: VEHICLE & DRIVER ASSIGNMENT SHEET */}
      <Sheet open={dispatchModal} onOpenChange={setDispatchModal}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Order Desk: Assign Vehicle & Driver</SheetTitle>
            <SheetDescription>
              Assign logistics transport for Order #{selectedOrderForDispatch?.id} (
              {selectedOrderForDispatch?.customer_name})
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleDispatchOrder} className="mt-6 space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-bold text-foreground">
                  {selectedOrderForDispatch?.customer_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items:</span>
                <span className="font-semibold text-foreground">
                  {selectedOrderForDispatch?.items_summary}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Attached Invoice:</span>
                <span className="font-mono font-bold text-primary">
                  {dbInvoices.find((i) => i.order_id === selectedOrderForDispatch?.id)?.id ||
                    `INV-${selectedOrderForDispatch?.id?.replace("ORD-", "")}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transport Path:</span>
                <span className="font-semibold text-foreground">
                  {selectedOrderForDispatch?.transport_mode || "Logistics / Assigned Vehicle"}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border/50">
                <span className="text-muted-foreground">Destination:</span>
                <span className="font-medium text-foreground text-right">
                  {selectedOrderForDispatch?.delivery_address || "Client Warehouse"}
                </span>
              </div>
            </div>

            {selectedOrderForDispatch?.transport_mode === "Manufacturer Vehicle" ? (
              <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10 space-y-2 text-xs">
                <p className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <Check className="size-4" />
                  Path 1: Manufacturer Vehicle Collection
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  The manufacturer has its own vehicle and directly collects this order. No company
                  logistics vehicle is required.
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <label className="drawer-field">
                    Manufacturer Driver / Rep Name
                    <input
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="e.g. Ramesh (Driver)"
                    />
                  </label>
                  <label className="drawer-field">
                    Driver / Rep Phone
                    <input
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <label className="drawer-field">
                    Scheduled Delivery Date
                    <input
                      type="date"
                      required
                      value={dispatchDate}
                      onChange={(e) => setDispatchDate(e.target.value)}
                    />
                  </label>

                  <label className="drawer-field">
                    Delivery Time Window
                    <select
                      value={dispatchTimeWindow}
                      onChange={(e) => setDispatchTimeWindow(e.target.value)}
                    >
                      <option value="Morning (09:00 - 13:00)">Morning (09:00 - 13:00)</option>
                      <option value="Afternoon (13:00 - 17:00)">Afternoon (13:00 - 17:00)</option>
                      <option value="Evening (17:00 - 21:00)">Evening (17:00 - 21:00)</option>
                      <option value="Express Same-Day">Express Same-Day</option>
                    </select>
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="drawer-field">
                    Select Company Fleet Vehicle *
                    <select
                      value={vehicleNo}
                      onChange={(e) => {
                        const plate = e.target.value;
                        setVehicleNo(plate);
                        const matched = dbVehicles.find((v) => v.plate_number === plate);
                        if (matched?.assigned_driver_name || matched?.driver_name) {
                          setDriverName(matched.assigned_driver_name || matched.driver_name || "");
                        }
                        if (matched?.assigned_driver_phone || matched?.driver_phone) {
                          setDriverPhone(
                            matched.assigned_driver_phone || matched.driver_phone || "",
                          );
                        }
                      }}
                      className="text-xs"
                      required
                    >
                      <option value="">-- Choose Available Vehicle --</option>
                      {dbVehicles.map((v) => {
                        const isDispatched = v.status === "Dispatched / On Delivery";
                        return (
                          <option key={v.id} value={v.plate_number} disabled={isDispatched}>
                            {v.plate_number} ({v.make_model}) — [{v.status}]
                            {isDispatched ? " ⚠️ UNAVAILABLE (IN TRANSIT)" : ""}
                          </option>
                        );
                      })}
                    </select>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Vehicles currently <strong>Dispatched / On Delivery</strong> cannot be
                      allotted.
                    </p>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="drawer-field">
                    Driver Name *
                    <input
                      required
                      list="driver-logins"
                      value={driverName}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDriverName(value);
                        const match = driverChoices.find((driver) => driver.name === value);
                        if (match?.phone) setDriverPhone(match.phone);
                      }}
                      placeholder="e.g. Mahesh Patel"
                    />
                    <datalist id="driver-logins">
                      {driverChoices.map((driver) => (
                        <option key={driver.name} value={driver.name} />
                      ))}
                    </datalist>
                  </label>
                  <label className="drawer-field">
                    Driver Phone Number
                    <input
                      value={driverPhone}
                      onChange={(e) => setDriverPhone(e.target.value)}
                      placeholder="e.g. +91 98450 33445"
                    />
                  </label>
                </div>
              </>
            )}

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground">
              <p className="font-semibold text-foreground">Logistics Protocol Notice:</p>
              <p className="mt-0.5">
                {selectedOrderForDispatch?.transport_mode === "Manufacturer Vehicle"
                  ? "Tracked as manufacturer-arranged transport. Ready for direct warehouse collection."
                  : `Once confirmed by Order Desk, this trip will appear in Driver ${driverName || "assigned driver"}'s mobile delivery terminal with the commercial invoice attached.`}
              </p>
            </div>

            <Button type="submit" className="w-full mt-4 h-10 font-bold">
              <Truck className="size-4 mr-1.5" />
              {selectedOrderForDispatch?.transport_mode === "Manufacturer Vehicle"
                ? "Confirm & Release for Manufacturer Collection"
                : "Confirm Assignment & Release to Driver"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* COMMERCIAL INVOICE VIEWER SHEET (For Driver & Order Desk) */}
      <Sheet open={invoiceViewModal} onOpenChange={setInvoiceViewModal}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileCheck2 className="size-5 text-primary" />
              Commercial Tax Invoice #
              {viewingInvoice?.id ||
                (viewingOrder ? `INV-${viewingOrder.id.replace("ORD-", "")}` : "")}
            </SheetTitle>
            <SheetDescription>
              Accounts Verified Invoice · Order #{viewingOrder?.id}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-5">
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex justify-between items-start pb-3 border-b border-border">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                    Billed To Customer
                  </span>
                  <h4 className="text-base font-extrabold text-foreground mt-0.5">
                    {viewingInvoice?.customer_name || viewingOrder?.customer_name}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    {viewingOrder?.delivery_address || "Standard Client Warehouse Destination"}
                  </p>
                </div>
                <span className="status success">{viewingInvoice?.status || "Generated"}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div>
                  <span className="text-muted-foreground block">Invoice Issue Date:</span>
                  <span className="font-semibold text-foreground mt-0.5 block">
                    {viewingInvoice?.created_at?.split("T")[0] ||
                      new Date().toISOString().split("T")[0]}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Payment Due Date:</span>
                  <span className="font-semibold text-foreground mt-0.5 block">
                    {viewingInvoice?.due_date || "Within 15 Days"}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items Details */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <span className="text-xs font-bold text-foreground block">
                Deliverable Commercial Line Items
              </span>
              <div className="rounded-lg border border-border bg-card p-3 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">
                    {viewingOrder?.items_summary || "B2B Goods Items"}
                  </span>
                  <span className="font-bold text-foreground">
                    {viewingOrder?.total_amount
                      ? money(viewingOrder.total_amount)
                      : money(viewingInvoice?.amount || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/50">
                  <span>Authorized by Accounts: Suresh Rao</span>
                  <span>GST Compliant</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal Amount:</span>
                  <span>{money(viewingOrder?.subtotal || viewingInvoice?.amount || 0)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount & Deductions:</span>
                  <span>{money(viewingOrder?.discount || 0)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-foreground pt-1.5 border-t border-border">
                  <span>Total Payable:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {money(viewingInvoice?.amount || viewingOrder?.total_amount || 0)}
                  </span>
                </div>
              </div>
            </div>

            <Button
              className="w-full text-xs font-bold flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              onClick={() => {
                if (viewingInvoice) {
                  handleDownloadInvoice(viewingInvoice, viewingOrder);
                } else if (viewingOrder) {
                  const synthInv: DBInvoice = {
                    id: `INV-${viewingOrder.id.replace("ORD-", "")}`,
                    order_id: viewingOrder.id,
                    company_id: viewingOrder.company_id,
                    customer_name: viewingOrder.customer_name,
                    amount: viewingOrder.total_amount,
                    paid_amount: 0,
                    remaining_amount: viewingOrder.total_amount,
                    status: "Generated",
                    due_date:
                      new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0] || "",
                    created_at: viewingOrder.created_at || new Date().toISOString(),
                  };
                  handleDownloadInvoice(synthInv, viewingOrder);
                }
              }}
            >
              <Download className="size-4" />
              Download Tax Invoice (PDF / Print)
            </Button>
            <Button
              variant="outline"
              className="w-full text-xs font-bold cursor-pointer"
              onClick={() => setInvoiceViewModal(false)}
            >
              Close Invoice Viewer
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ENTER BILL DETAILS & RAISE INVOICE SHEET */}
      <Sheet open={raiseInvoiceModal} onOpenChange={setRaiseInvoiceModal}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileCheck2 className="size-5 text-primary" />
              Enter Bill Details
            </SheetTitle>
            <SheetDescription>
              Raise commercial tax invoice for Order #{selectedOrderForInvoice?.id}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleConfirmRaiseInvoice} className="mt-6 space-y-4">
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Order ID:</span>
                <span className="font-mono font-bold text-foreground">
                  #{selectedOrderForInvoice?.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-bold text-foreground">
                  {selectedOrderForInvoice?.customer_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Deliverable:</span>
                <span className="text-foreground">
                  {selectedOrderForInvoice?.items_summary || "Commercial Goods"}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border/60">
                <span className="text-muted-foreground font-semibold">Billable Total:</span>
                <span className="font-extrabold text-foreground text-sm">
                  {money(selectedOrderForInvoice?.total_amount || 0)}
                </span>
              </div>
            </div>

            <label className="drawer-field">
              Invoice Number
              <input
                required
                value={customInvoiceNumber}
                onChange={(e) => setCustomInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-1001"
              />
            </label>

            <label className="drawer-field">
              Payment Due Date
              <input
                type="date"
                required
                value={customDueDate}
                onChange={(e) => setCustomDueDate(e.target.value)}
              />
            </label>

            <label className="drawer-field">
              Billing Notes & Terms
              <textarea
                rows={3}
                value={customBillNotes}
                onChange={(e) => setCustomBillNotes(e.target.value)}
                placeholder="e.g. 15 days credit terms. Vehicle and driver booking enabled once invoice is generated."
                className="w-full text-xs p-2.5 rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary"
              />
            </label>

            <div className="pt-2 space-y-2">
              <Button
                type="submit"
                disabled={raisingInvoice}
                className="w-full font-bold gap-2 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <FileCheck2 className="size-4" />
                {raisingInvoice ? "Raising Invoice..." : "Confirm & Raise Invoice"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                After raising the invoice, book the driver on Order desk.
              </p>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* EDIT CUSTOMER CREDIT TERMS SHEET */}
      <Sheet open={editCreditModal} onOpenChange={setEditCreditModal}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Scale className="size-5 text-primary" />
              Edit Credit Terms
            </SheetTitle>
            <SheetDescription>
              Update credit limit and credit days payment terms for {selectedCreditCustomer?.name}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSaveCreditLimit} className="mt-6 space-y-4">
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-bold text-foreground">{selectedCreditCustomer?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Operating Company:</span>
                <span className="font-semibold text-foreground">
                  {companies.find((c) => c.id === selectedCreditCustomer?.company_id)?.name ||
                    "All Companies"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Status:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {selectedCreditCustomer?.status || "Active"}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Credit Limit (₹)</label>
              <input
                type="number"
                step="1000"
                value={editCreditLimit}
                onChange={(e) => setEditCreditLimit(e.target.value)}
                required
                className="w-full h-10 px-3 text-xs rounded-lg border border-border bg-card font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="e.g. 500000"
              />
              <p className="text-[11px] text-muted-foreground">
                Maximum permissible outstanding exposure before warning alerts trigger.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">
                Credit Days (Payment Terms)
              </label>
              <input
                type="number"
                min="0"
                max="180"
                value={editCreditDays}
                onChange={(e) => setEditCreditDays(e.target.value)}
                required
                className="w-full h-10 px-3 text-xs rounded-lg border border-border bg-card font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="e.g. 30"
              />
              <p className="text-[11px] text-muted-foreground">
                Permitted payment settlement window in days from invoice generation.
              </p>
            </div>

            <div className="pt-4 flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => setEditCreditModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={savingCreditLimit}
                className="flex-1 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {savingCreditLimit ? "Saving..." : "Save Credit Terms"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* DRIVER PROOF OF DELIVERY (POD) SHEET */}
      <Sheet open={podModal} onOpenChange={setPodModal}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Truck className="size-5 text-primary" />
              Proof of Delivery (POD)
            </SheetTitle>
            <SheetDescription>
              Record delivery verification for Order #{selectedDeliveryForPod?.order_id}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmittingPod} className="mt-6 space-y-5">
            {/* Outcome Selection: Complete / Partial / Failed */}
            <div>
              <label className="text-xs font-bold text-foreground block mb-2">
                Delivery Outcome Verification *
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPodOutcome("Delivered");
                    const ord = dbOrders.find((o) => o.id === selectedDeliveryForPod?.order_id);
                    const qty = ord ? parseFloat(ord.items_summary?.match(/(\d+)/)?.[1] || "1") : 1;
                    setPodDeliveredQty(String(qty));
                    setPodRemainingQty("0");
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    podOutcome === "Delivered"
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500/30"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Check className="size-4" />
                  <span>Complete</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPodOutcome("Partially Delivered");
                    const ord = dbOrders.find((o) => o.id === selectedDeliveryForPod?.order_id);
                    const totalQty = ord
                      ? parseFloat(ord.items_summary?.match(/(\d+)/)?.[1] || "10")
                      : 10;
                    const half = Math.max(1, Math.floor(totalQty / 2));
                    setPodDeliveredQty(String(half));
                    setPodRemainingQty(String(totalQty - half));
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    podOutcome === "Partially Delivered"
                      ? "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-2 ring-amber-500/30"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <Package className="size-4" />
                  <span>Partial</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPodOutcome("Failed");
                    setPodDeliveredQty("0");
                    const ord = dbOrders.find((o) => o.id === selectedDeliveryForPod?.order_id);
                    const qty = ord ? parseFloat(ord.items_summary?.match(/(\d+)/)?.[1] || "1") : 1;
                    setPodRemainingQty(String(qty));
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    podOutcome === "Failed"
                      ? "border-red-500 bg-red-500/15 text-red-700 dark:text-red-400 ring-2 ring-red-500/30"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <X className="size-4" />
                  <span>Failed</span>
                </button>
              </div>
            </div>

            {/* RECEIVER DETAILS (Mandatory for Complete & Partial) */}
            {podOutcome !== "Failed" && (
              <div className="space-y-3 p-3.5 rounded-xl border border-border bg-muted/20">
                <p className="text-xs font-bold text-foreground">Receiver Sign-off Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="drawer-field">
                    Received By Name *
                    <input
                      required
                      value={podReceiverName}
                      onChange={(e) => setPodReceiverName(e.target.value)}
                      placeholder="Receiver person name"
                    />
                  </label>
                  <label className="drawer-field">
                    Receiver Phone Number
                    <input
                      value={podReceiverPhone}
                      onChange={(e) => setPodReceiverPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* PARTIAL QUANTITY VALIDATION */}
            {podOutcome === "Partially Delivered" && (
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-3">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                  Partial Quantity Breakdown & Return Goods
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="drawer-field">
                    Delivered Quantity *
                    <input
                      type="number"
                      required
                      min="1"
                      value={podDeliveredQty}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setPodDeliveredQty(e.target.value);
                        const ord = dbOrders.find((o) => o.id === selectedDeliveryForPod?.order_id);
                        const total = ord
                          ? parseFloat(ord.items_summary?.match(/(\d+)/)?.[1] || "10")
                          : 10;
                        setPodRemainingQty(String(Math.max(0, total - val)));
                      }}
                    />
                  </label>
                  <label className="drawer-field">
                    Remaining / Returned Qty
                    <input
                      type="number"
                      readOnly
                      value={podRemainingQty}
                      className="bg-muted text-muted-foreground font-bold cursor-not-allowed"
                    />
                  </label>
                </div>
                <label className="drawer-field">
                  Return-Goods Handling Notes *
                  <input
                    required
                    value={podReturnNotes}
                    onChange={(e) => setPodReturnNotes(e.target.value)}
                    placeholder="e.g. Warehouse storage full; 10 bags returning to central hub"
                  />
                </label>
              </div>
            )}

            {/* FAILURE REASONS */}
            {podOutcome === "Failed" && (
              <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 space-y-3">
                <p className="text-xs font-bold text-red-800 dark:text-red-300">
                  Delivery Attempt Failure Details
                </p>
                <label className="drawer-field">
                  Reason for Failure *
                  <select
                    value={podFailureReason}
                    onChange={(e) => setPodFailureReason(e.target.value)}
                  >
                    <option value="Customer unavailable / door locked">
                      Customer unavailable / door locked
                    </option>
                    <option value="Address not found / road inaccessible">
                      Address not found / road inaccessible
                    </option>
                    <option value="Customer rejected order">Customer rejected order</option>
                    <option value="Damaged in transit / quality dispute">
                      Damaged in transit / quality dispute
                    </option>
                    <option value="Payment not settled upon delivery">
                      Payment not settled upon delivery
                    </option>
                    <option value="Vehicle breakdown / emergency">
                      Vehicle breakdown / emergency
                    </option>
                  </select>
                </label>
                <label className="drawer-field">
                  Return-Goods Handling & Disposition
                  <input
                    required
                    value={podReturnNotes}
                    onChange={(e) => setPodReturnNotes(e.target.value)}
                    placeholder="e.g. Entire consignment returned to origin warehouse"
                  />
                </label>
              </div>
            )}

            <div className="space-y-2 p-3.5 rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <MapPin className="size-4 text-primary" /> Delivery location *
                </span>
                {podGps && (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    Locked
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground font-mono truncate">
                {podGps
                  ? `${podGps.lat.toFixed(4)}, ${podGps.lng.toFixed(4)} · ${podGps.time}`
                  : "No coordinates acquired"}
              </p>
              <button
                type="button"
                onClick={capturePodLocation}
                className="w-full py-1.5 px-2 rounded-lg text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <MapPin className="size-3" />
                <span>{podGps ? "Refresh GPS" : "Acquire GPS"}</span>
              </button>
              {podGpsError && <p className="text-[11px] text-destructive">{podGpsError}</p>}
            </div>

            <div className="space-y-2 p-3.5 rounded-xl border border-border bg-card">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Camera className="size-4 text-primary" />
                Proof of Delivery Photo (Camera Capture) *
              </label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                required={podPhotoUrls.length === 0}
                className="text-xs w-full file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:opacity-90"
                onChange={handlePodPhoto}
              />
              {podPhotoError && <p className="text-[11px] text-destructive">{podPhotoError}</p>}
              {podPhotoPreview && (
                <div className="mt-2 relative rounded-lg overflow-hidden border border-border max-h-40">
                  <img
                    src={podPhotoPreview}
                    alt="POD Capture Preview"
                    className="w-full h-40 object-cover"
                  />
                  <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white px-2 py-0.5 rounded font-mono">
                    Captured POD
                  </span>
                </div>
              )}
            </div>

            <label className="drawer-field">
              Driver Remarks / Observations
              <input
                value={podRemarks}
                onChange={(e) => setPodRemarks(e.target.value)}
                placeholder="Optional delivery notes or customer remarks"
              />
            </label>

            <Button
              type="submit"
              disabled={!deliveryProofReady(podGps, podPhotoUrls)}
              className={`w-full h-11 text-xs font-extrabold shadow-sm ${
                podOutcome === "Delivered"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : podOutcome === "Partially Delivered"
                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
              }`}
            >
              <Check className="size-4 mr-1.5" />
              Submit Proof of Delivery ({podOutcome})
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* RECORD PAYMENT SHEET */}
      <Sheet open={paymentModal} onOpenChange={setPaymentModal}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Record Payment for {selectedInvoiceForPayment?.id}</SheetTitle>
            <SheetDescription>
              Customer: {selectedInvoiceForPayment?.customer_name}
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleRecordPaymentSubmit} className="mt-6 space-y-4">
            <div className="rounded border border-border p-3 text-xs bg-muted/20">
              <p>
                Invoice Total:{" "}
                <b className="font-semibold">{money(selectedInvoiceForPayment?.amount || 0)}</b>
              </p>
              <p className="mt-1">
                Remaining:{" "}
                <b className="font-semibold text-warning">
                  {money(selectedInvoiceForPayment?.remaining_amount || 0)}
                </b>
              </p>
            </div>
            <label className="drawer-field">
              Amount to Record (₹)
              <input
                type="number"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />
            </label>
            <label className="drawer-field">
              Payment Method
              <select
                value={payMethod}
                onChange={(e) =>
                  setPayMethod(e.target.value as "Bank Transfer" | "Cheque" | "Cash" | "UPI")
                }
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
                <option value="Cheque">Cheque</option>
                <option value="Cash">Cash</option>
              </select>
            </label>
            <label className="drawer-field">
              Reference / Transaction ID
              <input
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="TXN or Cheque Number"
              />
            </label>
            <Button type="submit" className="w-full mt-6">
              Submit Payment Receipt
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      {/* FLEET: ADD / EDIT VEHICLE SHEET */}
      <Sheet open={vehicleModal} onOpenChange={setVehicleModal}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Truck className="size-5" />
              </span>
              <div>
                <SheetTitle className="text-base font-bold">
                  {editingVehicle ? "Edit Fleet Vehicle" : "Add Company Vehicle"}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {editingVehicle
                    ? `Update vehicle details & real-time status for ${editingVehicle.plate_number}`
                    : "Register a new vehicle into the company logistics fleet"}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <form onSubmit={handleSaveVehicle} className="mt-6 space-y-4">
            <label className="drawer-field">
              Vehicle Make & Model *
              <input
                required
                value={truckName}
                onChange={(e) => setTruckName(e.target.value)}
                placeholder="e.g. Tata 1109, Eicher Pro 2049, Mahindra Bolero Maxi"
              />
            </label>

            <label className="drawer-field">
              Plate Registration Number *
              <input
                required
                value={truckPlate}
                onChange={(e) => setTruckPlate(e.target.value.toUpperCase())}
                placeholder="e.g. KA-01-AB-1024"
              />
            </label>

            <label className="drawer-field">
              Operating Company
              <select value={truckCompanyId} onChange={(e) => setTruckCompanyId(e.target.value)}>
                <option value="all">All Companies (Shared Fleet)</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="drawer-field">
              Payload Capacity
              <input
                value={truckCapacity}
                onChange={(e) => setTruckCapacity(e.target.value)}
                placeholder="e.g. 5 Tons, 3.5 Tons, 1.5 Tons"
              />
            </label>

            <label className="drawer-field">
              Current Vehicle Status *
              <select
                value={truckStatus}
                onChange={(e) => setTruckStatus(e.target.value as VehicleStatus)}
              >
                <option value="Available / At Godown">Available / At Godown</option>
                <option value="Dispatched / On Delivery">Dispatched / On Delivery</option>
                <option value="Returned to Godown">Returned to Godown</option>
                <option value="Assigned / Booked">Assigned / Booked</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="drawer-field">
                Default Driver Name
                <input
                  value={truckDriverName}
                  onChange={(e) => setTruckDriverName(e.target.value)}
                  placeholder="e.g. Mahesh Patel"
                />
              </label>

              <label className="drawer-field">
                Driver Contact Phone
                <input
                  value={truckDriverPhone}
                  onChange={(e) => setTruckDriverPhone(e.target.value)}
                  placeholder="+91 98450 11223"
                />
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1 cursor-pointer"
                disabled={vehicleSaving}
                onClick={() => setVehicleModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 font-semibold cursor-pointer"
                disabled={vehicleSaving}
              >
                {vehicleSaving ? "Saving..." : editingVehicle ? "Update Vehicle" : "Add Vehicle"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* SUPER ADMIN CONFIRM DELETE DIALOG */}
      <Sheet open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <Trash2 className="size-5" />
              </span>
              <div>
                <SheetTitle className="text-base text-destructive font-black">
                  Delete {deleteTarget?.type}?
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Super Admin Permanent Deletion
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 text-xs text-foreground space-y-2">
              <p className="text-muted-foreground">Are you sure you want to permanently delete:</p>
              <p className="font-bold text-sm text-foreground">"{deleteTarget?.name}"</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                As Super Admin, this action will permanently remove this record from the Supabase
                database. This operation cannot be reversed.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 text-xs cursor-pointer"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 text-xs font-bold gap-1.5 cursor-pointer"
                disabled={isDeleting}
                onClick={async () => {
                  if (!deleteTarget) return;
                  setIsDeleting(true);
                  try {
                    await deleteTarget.onDelete();
                    setDeleteTarget(null);
                    reloadData();
                  } catch (err) {
                    console.error("Deletion error:", err);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
              >
                <Trash2 className="size-3.5" />
                {isDeleting ? "Deleting..." : "Permanently Delete"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <p className="mt-7 text-xs text-muted-foreground">
        Connected to Supabase ·{" "}
        {company === "all" ? "All companies" : companies.find((c) => c.id === company)?.short}
      </p>
    </main>
  );
}
