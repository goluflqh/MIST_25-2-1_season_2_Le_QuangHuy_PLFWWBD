# Minh Hồng Fullstack Web App Plan (Next.js 14+)

## Goal
Phát triển website Minh Hồng từ giao diện tĩnh hiện tại thành một ứng dụng Fullstack hoàn chỉnh với các trang chi tiết, hệ thống Backend/Database (để quản lý yêu cầu tư vấn, users), kiểm thử tự động (Testing) và triển khai (Deploy) chuẩn chuyên nghiệp.

## Môi Trường & Project Type
- **Thể Loại (Type):** WEB APP (Cửa hàng B2B/B2C dịch vụ camera & pin).
- **Ngôn Ngữ & Framework:** Next.js App Router, TypeScript, Tailwind CSS v4.
- **Backend & Database:** Next.js Route Handlers (API), Prisma ORM + PostgreSQL (hoặc Supabase/Vercel Postgres) - *Đề xuất PostgreSQL cho quản lý dữ liệu an toàn.*
- **Testing:** Playwright cho E2E, Vitest/Jest cho Unit Tests.
- **Deployment:** Vercel (Auto CI/CD).

## Các Giai Đoạn (Phân chia để chạy từng bước)

Dưới đây là sơ đồ breakdown các task. Mỗi Phase sẽ được gọi các Agent Specialist riêng biệt thực thi để đảm bảo tuân thủ nguyên tắc Clean Code và bảo mật.

### Phase 1: Frontend & Routing Mở Rộng
*Agent chịu trách nhiệm: `@frontend-specialist`*
- [x] Task 1.1: Tạo cấu trúc folder thư mục các trang tĩnh quan trọng (`/dich-vu/dong-pin`, `/dich-vu/camera`) → Verify: Chạy `npm run dev` không bị lỗi 404.
- [x] Task 1.2: Tạo trang Xác thực Authentication UI (`/dang-nhap`, `/dang-ky`) → Verify: Giao diện form hiển thị đúng Tailwind v4.
- [x] Task 1.3: Cập nhật lại Navbar & Footer để liên kết đúng URL thay vì anchor links `#` → Verify: Bấm vào link chuyển trang không bị giật/load lại toàn trang.

### Phase 2: Database & Backend Architecture
*Agent chịu trách nhiệm: `@database-architect`, `@backend-specialist`*
- [ ] Task 2.1: Cài đặt Prisma ORM và khởi tạo schema DB: `User`, `ContactRequest`, `Session` → Verify: Chạy `npx prisma generate` thành công.
- [ ] Task 2.2: Tích hợp Database Provider (PostgreSQL url) vào `.env` → Verify: Prisma migrate thành công lên Database Local/Preview.
- [ ] Task 2.3: Viết API Server Action lưu trữ Yêu Cầu Tư Vấn từ form ngoài Trang Chủ vào DB → Verify: API trả về 200 OK và data hiện trong DB.
- [ ] Task 2.4: Xây dựng hệ thống Xác thực (Auth) bằng `NextAuth.js` (hoặc custom session server action) → Verify: Đăng ký/Đăng nhập sinh token/session an toàn.

### Phase 3: Dashboard & Quản Trị (Admin Panel)
*Agent chịu trách nhiệm: `@frontend-specialist` & `@backend-specialist`*
- [ ] Task 3.1: Dựng layout `app/(admin)/dashboard/layout.tsx` cho quản trị viên → Verify: Giao diện Admin có thanh sidebar và báo cáo.
- [ ] Task 3.2: Viết trang hiển thị danh sách Yêu Cầu Tư Vấn (`ContactRequest`) bảo vệ bằng Auth → Verify: Chỉ tài khoản Admin mới xem được bảng này.

### Phase 4: AI Chatbot Tư Vấn Tự Động
*Agent chịu trách nhiệm: `@backend-specialist` & `@frontend-specialist`*
- [ ] Task 4.1: Xây dựng UI Chatbot widget (floating bubble + panel chat) tích hợp vào layout chung → Verify: Mở/đóng chat mượt, responsive trên mobile.
- [ ] Task 4.2: Tạo API Route `/api/chat` xử lý tin nhắn bằng AI (Google Gemini / OpenAI) qua API Key từ `.env` → Verify: Gửi câu hỏi mở nhận phản hồi AI hợp lý.
- [ ] Task 4.3: Xây dựng hệ thống FAQ cố định (câu hỏi thường gặp) kết hợp fallback sang AI cho câu hỏi mở → Verify: Câu hỏi phổ biến trả lời tức thì, câu hỏi mới gọi API AI.

### Phase 5: Testing & Automation
*Agent chịu trách nhiệm: `@test-engineer`, `@security-auditor`*
- [ ] Task 5.1: Làm quen và viết test Playwright cho luồng gửi báo giá (User Flow) → Verify: Lệnh `npx playwright test` pass.
- [ ] Task 5.2: Audit bảo mật và kiểm tra UI UX bằng các script `.agent/scripts/*` → Verify: Code không có lỗ hổng bảo mật rò rỉ JWT/Key.

### Phase 6: CI/CD & Deploy (Release)
*Agent chịu trách nhiệm: `@devops-engineer` / `@orchestrator`*
- [ ] Task 6.1: Thiết lập biến môi trường chuẩn bị cho Production.
- [ ] Task 6.2: Tối ưu hoá Bundle Size và Lighthouse score → Verify: `npm run build` pass, bundle nhẹ < 200KB initial chunk.
- [ ] Task 6.3: Deploy Vercel và gắn custom domain.

## Done When

- [x] Layout và các trang phụ được hoàn tất (Phase 1).
- [ ] Backend lưu vào Database chạy thành công trên Development (Phase 2 & 3).
- [ ] AI Chatbot tư vấn hoạt động hai chiều: FAQ + AI mở (Phase 4).
- [ ] Test E2E vượt qua đánh giá (Phase 5).
- [ ] Sản phẩm Release ra môi trường thật (Phase 6).

---
*Lưu ý: Không thực hiện chồng chéo hay chạy một phát từ Phase 1 tới Phase 6. Các agent sẽ hoàn tất từng Phase trước khi yêu cầu ý kiến xác nhận từ User.*
