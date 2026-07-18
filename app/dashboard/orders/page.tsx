import { listActiveServiceOrderViews } from "@/lib/service-orders";
import AdminServiceOrdersClient from "./AdminServiceOrdersClient";

export default async function AdminServiceOrdersPage() {
  const orders = await listActiveServiceOrderViews();

  return <AdminServiceOrdersClient initialOrders={orders} />;
}
