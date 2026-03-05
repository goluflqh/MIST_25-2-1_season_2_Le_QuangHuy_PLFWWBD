import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const pricingItems = [
  { category: "PIN", name: "Pin máy khoan / bắn vít", price: "350.000 - 800.000đ", note: "Tuỳ dung lượng & hãng", sortOrder: 1 },
  { category: "PIN", name: "Pin máy cắt / máy mài", price: "500.000 - 1.200.000đ", note: "Tuỳ số cell", sortOrder: 2 },
  { category: "PIN", name: "Pin xe đạp điện", price: "2.000.000 - 5.000.000đ", note: "Tuỳ Ah & loại xe", sortOrder: 3 },
  { category: "PIN", name: "Pin xe máy điện", price: "3.500.000 - 8.000.000đ", note: "Tuỳ dung lượng", sortOrder: 4 },
  { category: "PIN", name: "Pin loa kéo", price: "200.000 - 500.000đ", note: "Tuỳ hãng loa", sortOrder: 5 },
  { category: "PIN", name: "Pin laptop (thay cell)", price: "400.000 - 900.000đ", note: "Tuỳ hãng & model", sortOrder: 6 },
  { category: "NLMT", name: "Thay pin đèn NLMT", price: "150.000 - 400.000đ", note: "Tuỳ dung lượng", sortOrder: 1 },
  { category: "NLMT", name: "Đèn pha NLMT 100W-300W", price: "500.000 - 1.500.000đ", note: "Bao lắp đặt", sortOrder: 2 },
  { category: "NLMT", name: "Pin lưu trữ NLMT", price: "Liên hệ", note: "Tuỳ hệ thống", sortOrder: 3 },
  { category: "LUU_TRU", name: "Pin kích đề ô tô 12V", price: "800.000 - 2.000.000đ", note: "Tuỳ dòng xả", sortOrder: 1 },
  { category: "LUU_TRU", name: "Pin dự phòng dung lượng lớn", price: "500.000 - 3.000.000đ", note: "Tuỳ mAh", sortOrder: 2 },
  { category: "LUU_TRU", name: "Đóng bình pin theo yêu cầu", price: "Liên hệ", note: "Báo giá theo thông số", sortOrder: 3 },
  { category: "CAMERA", name: "Trọn bộ 2 camera", price: "2.500.000 - 4.000.000đ", note: "Bao lắp đặt", sortOrder: 1 },
  { category: "CAMERA", name: "Trọn bộ 4 camera", price: "4.000.000 - 7.000.000đ", note: "Bao lắp đặt", sortOrder: 2 },
  { category: "CAMERA", name: "Camera PTZ xoay 360°", price: "1.500.000 - 3.000.000đ/cam", note: "Tuỳ hãng", sortOrder: 3 },
  { category: "CAMERA", name: "Khảo sát tận nơi", price: "MIỄN PHÍ", note: "Đà Nẵng & lân cận", sortOrder: 4 },
];

async function main() {
  console.log("Seeding pricing items...");

  // Clear existing pricing items
  await prisma.pricingItem.deleteMany();

  // Insert seed data
  for (const item of pricingItems) {
    await prisma.pricingItem.create({
      data: { ...item, unit: "VNĐ", active: true },
    });
  }

  console.log(`✅ Seeded ${pricingItems.length} pricing items.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
