# DriveMio — hướng dẫn tiếng Việt

## 1. Giới thiệu

DriveMio giúp bạn xem video **private** trên Google Drive bằng Nuvio TV hoặc ứng dụng hỗ trợ addon Stremio. Cloudflare Worker lấy video từ Drive và truyền tới TV. Video không cần đặt public. Addon không chuyển mã video, nên hãy thử MP4 H.264/AAC trước.

Cách hoạt động: tải video vào một thư mục Drive → chạy `make generate-media` để tạo danh sách → chạy `make deploy` → cài URL do `make manifest-url` in ra vào Nuvio. Khi thêm video, bạn phải tạo lại danh sách và deploy lại. Không cần tạo một thư mục cho mỗi video. Ảnh poster là tùy chọn và phải có URL HTTPS công khai nếu muốn hiển thị trên TV.

Bạn cần Git, `make`, Node.js 22.13+ hoặc 24+, một tài khoản Google và một tài khoản Cloudflare. Dự án dành cho một người dùng; không có tài khoản riêng cho từng người xem.

## 2. Các giá trị trong `.dev.vars.example`

Tạo file riêng trên máy bằng `cp .dev.vars.example .dev.vars` rồi điền các giá trị sau:

| Biến | Điền gì? | Lấy ở đâu? |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Client ID của OAuth app | Google Cloud → Google Auth platform → Clients |
| `GOOGLE_CLIENT_SECRET` | Client secret của cùng OAuth app | Cùng trang trên |
| `GOOGLE_REFRESH_TOKEN` | **Refresh token**, không phải access token | OAuth 2.0 Playground, sau bước Exchange authorization code for tokens |
| `ADDON_TOKEN` | Chuỗi ngẫu nhiên để bảo vệ URL addon | Chạy `openssl rand -hex 32` |
| `STREAM_SIGNING_SECRET` | Chuỗi ngẫu nhiên **khác** để ký URL video | Chạy lại `openssl rand -hex 32` |
| `PUBLIC_BASE_URL` | Giữ `http://localhost:8787` để chạy local | Đã có sẵn trong file mẫu |
| `STREAM_URL_TTL_SECONDS` | Số giây URL video có hiệu lực; mặc định `3600` | Có thể giữ nguyên |
| `DRIVE_FOLDER_ID` | ID của thư mục chứa video | Phần sau `/folders/` trong URL thư mục Drive |

File `wrangler.jsonc` có hai giá trị bạn cũng cần sửa: `name` là tên Worker, còn `vars.PUBLIC_BASE_URL` là địa chỉ HTTPS của Worker, ví dụ `https://my-videos.my-subdomain.workers.dev`. Giá trị này **khác** `PUBLIC_BASE_URL` local trong `.dev.vars`. Các tên secret trong `wrangler.jsonc` không phải giá trị secret.

`.dev.vars`, `wrangler.jsonc` thật và `src/data/media.json` đều được Git bỏ qua. Chỉ đưa các file `*.example` lên repo. Giữ kín URL manifest do `make manifest-url` in ra vì nó chứa `ADDON_TOKEN`.

## 3. Lấy từng giá trị và triển khai

Trước tiên, tải mã nguồn và tạo các file cấu hình riêng trên máy:

```bash
git clone https://github.com/gemzruby/stremio-gdrive-addon.git
cd stremio-gdrive-addon
make install
cp .dev.vars.example .dev.vars
cp wrangler.example.jsonc wrangler.jsonc
```

### Bước 1 — Tạo thư mục Drive và tải video

1. Trong [Google Drive](https://drive.google.com/), tạo thư mục, ví dụ `stremio-videos`. Giữ quyền truy cập **Restricted / Bị hạn chế**; không cần “Anyone with the link”.
2. Tải một video thử như `demo-1.mp4` trực tiếp vào thư mục. Tài khoản Google dùng ở bước OAuth phải tải được tệp này.
3. Mở thư mục và lấy ID từ URL dạng `https://drive.google.com/drive/folders/<FOLDER_ID>`. Điền ID đó vào `DRIVE_FOLDER_ID` trong `.dev.vars`.

### Bước 2 — Tạo Google Cloud project và bật Drive API

1. Mở [Google Cloud Console](https://console.cloud.google.com/), đăng nhập bằng tài khoản Google có quyền xem video, rồi chọn **New project** ở thanh chọn project.
2. Đặt tên project và tạo. Bảo đảm project mới đang được chọn.
3. Vào **APIs & Services → Library**, tìm **Google Drive API**, mở trang API và bấm **Enable**. [Hướng dẫn chính thức](https://developers.google.com/workspace/guides/enable-apis).

### Bước 3 — Tạo OAuth client

1. Trong Google Cloud Console, vào **Google Auth platform → Branding**. Nếu thấy **Get started**, nhập tên app, email hỗ trợ và email liên hệ.
2. Ở **Audience**, chọn **External** nếu dùng tài khoản Google cá nhân. Nếu app còn ở **Testing**, thêm chính email Google của bạn vào **Test users**. Ở **Data Access**, thêm scope `https://www.googleapis.com/auth/drive.readonly` nếu giao diện yêu cầu khai báo scope. [Hướng dẫn OAuth consent](https://developers.google.com/workspace/guides/configure-oauth-consent).
3. Vào **Google Auth platform → Clients → Create client**. Chọn **Web application**.
4. Trong **Authorized redirect URIs**, thêm đúng `https://developers.google.com/oauthplayground`, rồi tạo client.
5. Sao chép **Client ID** và **Client secret** vào `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` trong `.dev.vars`.

### Bước 4 — Lấy refresh token

1. Mở [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/). Bấm biểu tượng bánh răng. Bật **Use your own OAuth credentials**, nhập Client ID và Client secret vừa tạo. Chọn **Access type: Offline**.
2. Ở **Step 1**, nhập scope `https://www.googleapis.com/auth/drive.readonly` và bấm **Authorize APIs**. Chọn đúng tài khoản Google có video và chấp thuận quyền truy cập.
3. Ở **Step 2**, bấm **Exchange authorization code for tokens**. Sao chép đúng ô **Refresh token** vào `GOOGLE_REFRESH_TOKEN`. **Access token** chỉ sống ngắn và không dùng cho biến này.
4. Để ý: [Playground có thể thu hồi token sau 24 giờ nếu không dùng OAuth credentials của bạn](https://developers.google.com/oauthplayground/). Google cũng [giới hạn refresh token của app External ở trạng thái Testing trong 7 ngày](https://developers.google.com/identity/protocols/oauth2#expiration). Nếu dùng lâu dài, xem xét chuyển OAuth app sang **In production**; Google có thể yêu cầu xác minh tùy scope và cách sử dụng.

### Bước 5 — Chuẩn bị project và kiểm tra Drive

Điền các giá trị Google đã lấy vào `.dev.vars`. Chạy `openssl rand -hex 32` **hai lần** để tạo hai secret khác nhau cho `ADDON_TOKEN` và `STREAM_SIGNING_SECRET`. Sau đó:

```bash
make preview-media
make generate-media
```

`make preview-media` phải đếm được video. Nếu báo lỗi Google OAuth, kiểm tra lại refresh token và OAuth client. `make generate-media` ghi danh sách vào `src/data/media.json`. Bạn có thể tự thêm `poster` và `background` bằng URL ảnh HTTPS công khai; ảnh private của Drive thường không dùng trực tiếp làm poster được.

### Bước 6 — Tạo tài khoản Cloudflare và deploy

1. Đăng ký/đăng nhập ở [Cloudflare Dashboard](https://dash.cloudflare.com/). **Workers Free** đủ để bắt đầu; [giới hạn gói Free](https://developers.cloudflare.com/workers/platform/pricing/) vẫn áp dụng.
2. Trong **Workers & Pages**, xem hoặc đặt subdomain `workers.dev` của tài khoản. [Cloudflare giải thích định dạng URL](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/).
3. Trong `wrangler.jsonc`, đổi `name` thành tên Worker bạn muốn, ví dụ `my-videos`. Đặt `vars.PUBLIC_BASE_URL` thành `https://my-videos.<your-subdomain>.workers.dev`. Không điền token Google vào file này.
4. Chạy:

```bash
make login
make deploy
make manifest-url
```

`make login` mở trình duyệt để cấp quyền cho Wrangler. `make deploy` chạy kiểm tra, tải mã và năm secret từ `.dev.vars` lên Cloudflare. `make manifest-url` in URL riêng tư để cài trong Nuvio.

### Bước 7 — Cài trên Nuvio TV

Trong Nuvio, mở **Add-ons**, chọn thêm addon bằng URL thủ công và nhập **toàn bộ** URL từ `make manifest-url`, bao gồm `/manifest.json`. Mở catalog **My Drive**, chọn video rồi chọn stream **Google Drive**. Thử phát và tua. Nếu catalog có video nhưng màn hình phát bị treo, thử `make preview-media` để kiểm tra refresh token; nếu token mới đã hoạt động local, chạy lại `make deploy` rồi thử một URL stream mới.

## 4. Các lệnh `make`

| Lệnh | Dùng khi nào? |
| --- | --- |
| `make help` | Xem danh sách lệnh. |
| `make install` | Sau khi clone repo; cài dependencies và tạo media mẫu nếu chưa có. |
| `make preview-media` | Kiểm tra Drive có bao nhiêu video; không sửa file. |
| `make generate-media` | Tạo lại catalog local từ thư mục Drive. |
| `make check` | Chạy typecheck, lint và test. |
| `make test` | Chỉ chạy test. |
| `make dev` | Chạy Worker local tại `http://localhost:8787`. |
| `make login` | Cho Wrangler quyền truy cập tài khoản Cloudflare. |
| `make deploy` | Tự chạy `make check`, rồi deploy mã và secrets lên Cloudflare. |
| `make manifest-url` | In URL manifest production để cài addon; giữ kín URL này. |

Khi thêm hoặc xóa video: `make generate-media && make deploy`. Nếu video nằm trong thư mục con: `make generate-media RECURSIVE=1`. Muốn dùng thư mục Drive khác cho một lần chạy: `make generate-media FOLDER_ID=<FOLDER_ID>`.
