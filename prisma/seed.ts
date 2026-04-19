// Database Seed Script
// Run: npx tsx prisma/seed.ts

import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function main() {
  console.log("🌱 Seeding database...");

  // --- Create Admin User ---
  const adminPassword = await hashPassword("admin123");
  const admin = await prisma.user.upsert({
    where: { phone: "0987443258" },
    update: {},
    create: {
      name: "Hồng (Admin)",
      phone: "0987443258",
      password: adminPassword,
      role: "ADMIN",
    },
  });
  console.log("✅ Admin user:", admin.name, "| Phone:", admin.phone);

  // --- Create Sample Customers ---
  const customers = [
    { name: "Nguyễn Văn Minh", phone: "0912345678" },
    { name: "Trần Thị Lan", phone: "0908765432" },
    { name: "Lê Hoàng Phúc", phone: "0933221100" },
  ];

  for (const c of customers) {
    const pw = await hashPassword("123456");
    const user = await prisma.user.upsert({
      where: { phone: c.phone },
      update: {},
      create: { ...c, password: pw, role: "CUSTOMER" },
    });
    console.log("✅ Customer:", user.name);
  }

  await prisma.contactRequest.deleteMany();
  console.log("🧹 Cleared existing contact requests.");

  // --- Create Sample Contact Requests ---
  const contactRequests = [
    {
      name: "Anh Tuấn",
      phone: "0901234567",
      service: "DONG_PIN",
      message: "Em cần đóng lại pin máy khoan Makita 18V, pin cũ dung lượng giảm nhiều rồi.",
      status: "PENDING",
      source: "service-dong-pin",
      sourcePath: "/?service=DONG_PIN&source=service-dong-pin#quote",
      utmSource: "facebook",
      utmCampaign: "battery-leads-april",
    },
    {
      name: "Chị Mai",
      phone: "0977654321",
      service: "CAMERA",
      message: "Nhà em cần lắp 4 mắt camera, 2 ngoài trời 2 trong nhà. Nhờ anh tư vấn giúp.",
      status: "CONTACTED",
      source: "service-camera",
      sourcePath: "/?service=CAMERA&source=service-camera#quote",
      referrer: "https://www.google.com/",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "camera-search",
    },
    {
      name: "Nguyễn Văn Minh",
      phone: "0912345678",
      service: "DONG_PIN",
      message: "Đóng pin xe đạp điện 48V 20Ah, cell Samsung. Cho em xin giá.",
      status: "IN_PROGRESS",
      source: "pricing-page",
      sourcePath: "/?source=pricing-page#quote",
    },
    {
      name: "Anh Hùng",
      phone: "0965432100",
      service: "CAMERA",
      message: "Cửa hàng tạp hoá cần lắp camera giám sát, khoảng 6 mắt. Khảo sát giúp anh.",
      status: "COMPLETED",
      source: "homepage",
      sourcePath: "/#quote",
    },
    {
      name: "Trần Thị Lan",
      phone: "0908765432",
      service: "KHAC",
      message: "Có sửa pin laptop Dell không ạ? Pin chai hết rồi.",
      status: "PENDING",
      source: "homepage",
      sourcePath: "/#quote",
      referrer: "https://facebook.com/",
      utmSource: "facebook",
      utmMedium: "social",
      utmContent: "organic-post",
    },
  ];

  for (const cr of contactRequests) {
    await prisma.contactRequest.create({ data: cr });
    console.log("✅ Contact Request:", cr.name, "→", cr.service, `(${cr.status})`);
  }

  console.log("\n🎉 Database seeded successfully!");
  console.log("📋 Admin login: 0987443258 / admin123");
  console.log("📋 Customer login: 0912345678 / 123456");
}

main()
  .catch((e) => {
    console.error("❌ Seed Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
