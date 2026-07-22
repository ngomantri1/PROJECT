# Checklist triển khai Elevator ERP

> Phạm vi: triển khai Docker Compose lên VPS Ubuntu. Tài liệu dùng biến `<IP_SERVER>`, không ghi IP, mật khẩu hoặc khóa thật.
>
> Cách dùng: thực hiện lần lượt từ trên xuống; chỉ chuyển bước khi kết quả kiểm tra đúng. Các khối `powershell` chạy trên **máy Windows local**, các khối `bash` chạy trên **VPS Ubuntu** sau khi SSH vào.

---

## Mục lục

1. [Quy ước và nguyên tắc dữ liệu](#1-quy-ước-và-nguyên-tắc-dữ-liệu)
2. [Checklist A — Triển khai lần đầu bằng file nén](#2-checklist-a--triển-khai-lần-đầu-bằng-file-nén)
3. [Checklist B — Thiết lập Git một lần cho cập nhật code](#3-checklist-b--thiết-lập-git-một-lần-cho-cập-nhật-code)
4. [Checklist C — Cập nhật code hằng ngày](#4-checklist-c--cập-nhật-code-hằng-ngày)
5. [Checklist D — Đồng bộ dữ liệu local lên VPS trong giai đoạn test](#5-checklist-d--đồng-bộ-dữ-liệu-local-lên-vps-trong-giai-đoạn-test)
6. [Checklist E — Kiểm tra, log và sao lưu](#6-checklist-e--kiểm-tra-log-và-sao-lưu)

---

## 1. Quy ước và nguyên tắc dữ liệu

### 1.1. Biến cần thay thế

| Biến | Ví dụ | Ý nghĩa |
| --- | --- | --- |
| `<IP_SERVER>` | `203.0.113.10` | IPv4 public của VPS |
| `<DOMAIN>` | `erp.example.com` | Tên miền khi đã cấu hình DNS |
| `<DUONG_DAN_PROJECT>` | `D:\PROJECT\ElevatorERP_FullMenu_UI` | Thư mục dự án local |

### 1.2. Quy tắc quan trọng

- Không đưa `.env`, mật khẩu, private key hoặc API key vào GitHub.
- Không copy trực tiếp `.data/postgres` giữa Windows và Ubuntu. Database phải chuyển bằng file backup `.sql` tạo từ `pg_dump`.
- Có thể chuyển `.data/uploads` và `.data/data-protection-keys` bằng file nén.
- Trong giai đoạn test, đồng bộ database local → VPS sẽ **ghi đè dữ liệu hiện có trên VPS**. Chỉ làm khi VPS chưa có dữ liệu vận hành độc lập.
- Khi chạy thật: chỉ đưa code lên VPS; database thay đổi qua migration và dữ liệu VPS phải được backup, không bị local ghi đè.

### 1.3. Đăng nhập VPS

Chạy trên Windows PowerShell:

```powershell
ssh root@<IP_SERVER>
```

Sau đó nhập mật khẩu của tài khoản `root` khi hệ thống hỏi. Trong lệnh này, `root` đã là tên người dùng; không cần nhập thêm username khác.

---

## 2. Checklist A — Triển khai lần đầu bằng file nén

> Dùng khi VPS mới hoàn toàn. Luồng này không yêu cầu Git.

### A1. Chuẩn bị hệ điều hành VPS

- [ ] Đăng nhập VPS.

```powershell
ssh root@<IP_SERVER>
```

- [ ] Cập nhật hệ điều hành.

```bash
apt update && apt upgrade -y
```

Mục đích: nhận bản vá bảo mật và các gói mới trước khi cài Docker. Lệnh chạy xong phải quay lại dấu nhắc `root@...#`.

- [ ] Khởi động lại VPS nếu vừa cập nhật kernel hoặc hệ thống yêu cầu reboot.

```bash
reboot
```

Chờ 1–2 phút rồi đăng nhập lại:

```powershell
ssh root@<IP_SERVER>
```

### A2. Cài Docker Engine và Docker Compose plugin

- [ ] Chạy lần lượt các lệnh sau trên VPS.

```bash
apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo \"${UBUNTU_CODENAME:-$VERSION_CODENAME}\") stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

- [ ] Kiểm tra Docker hoạt động.

```bash
docker --version
docker compose version
docker run hello-world
```

Kết quả cần thấy: có phiên bản Docker/Compose và dòng `Hello from Docker!`.

### A3. Bật firewall

> Phải mở SSH trước khi bật UFW để không bị mất kết nối.

- [ ] Chạy trên VPS.

```bash
apt install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status verbose
```

Kết quả cần thấy: firewall `active`; các cổng `22`, `80`, `443` là `ALLOW IN`.

### A4. Tạo thư mục triển khai trên VPS

- [ ] Chạy trên VPS.

```bash
mkdir -p /opt/elevator-erp
mkdir -p /opt/elevator-erp/data/{postgres,redis,uploads,data-protection-keys}
chmod 700 /opt/elevator-erp/data/data-protection-keys
exit
```

### A5. Đóng gói source tại máy local

> Chạy trên Windows PowerShell. Source archive không gồm `.env`, `.data`, file build và thư mục dependency nặng.

- [ ] Chạy:

```powershell
tar -czf D:\PROJECT\elevator-erp-source.tar.gz `
  --exclude=.git `
  --exclude=.data `
  --exclude=.env `
  --exclude=frontend/node_modules `
  --exclude=frontend/.next `
  --exclude=backend/bin `
  --exclude=backend/obj `
  -C D:\PROJECT\ElevatorERP_FullMenu_UI .

Get-Item D:\PROJECT\elevator-erp-source.tar.gz
```

### A6. Export database local

> Chỉ dùng khi cần đưa database local sang VPS. Local Docker Compose phải đang chạy PostgreSQL.

- [ ] Chạy trên Windows PowerShell:

```powershell
Set-Location 'D:\PROJECT\ElevatorERP_FullMenu_UI'
$postgresContainer = (docker compose ps -q postgres).Trim()

if ([string]::IsNullOrWhiteSpace($postgresContainer)) {
  throw 'Không tìm thấy PostgreSQL local. Hãy khởi động Docker Compose local trước.'
}

docker exec $postgresContainer sh -c "pg_dump -U elevator -d elevator_erp --clean --if-exists --no-owner --no-privileges -f /tmp/elevator_erp.sql"
docker cp "$($postgresContainer):/tmp/elevator_erp.sql" 'D:\PROJECT\elevator-erp-db.sql'
docker exec $postgresContainer rm -f /tmp/elevator_erp.sql
Get-Item 'D:\PROJECT\elevator-erp-db.sql'
```

Kết quả cần thấy: file `D:\PROJECT\elevator-erp-db.sql` có dung lượng lớn hơn 0.

### A7. Đóng gói uploads và Data Protection Keys

> Không đưa `.data/postgres` vào archive. PostgreSQL đã được xuất ở bước A6.

- [ ] Chạy trên Windows PowerShell:

```powershell
tar -czf D:\PROJECT\elevator-erp-files.tar.gz `
  -C D:\PROJECT\ElevatorERP_FullMenu_UI\.data `
  uploads data-protection-keys

Get-Item D:\PROJECT\elevator-erp-files.tar.gz
```

### A8. Upload các file lên VPS

- [ ] Chạy trên Windows PowerShell:

```powershell
scp D:\PROJECT\elevator-erp-source.tar.gz root@<IP_SERVER>:/opt/elevator-erp/
scp D:\PROJECT\elevator-erp-db.sql root@<IP_SERVER>:/opt/elevator-erp/
scp D:\PROJECT\elevator-erp-files.tar.gz root@<IP_SERVER>:/opt/elevator-erp/
```

Nhập mật khẩu `root` khi được hỏi. Nếu không có database hoặc file upload để chuyển, bỏ qua file tương ứng.

### A9. Giải nén source và tạo cấu hình production

- [ ] SSH vào VPS:

```powershell
ssh root@<IP_SERVER>
```

- [ ] Giải nén source trên VPS:

```bash
cd /opt/elevator-erp
tar -xzf elevator-erp-source.tar.gz
```

- [ ] Tạo `.env` production. Thay `<IP_SERVER>` trước khi chạy.

```bash
export IP_SERVER='<IP_SERVER>'
POSTGRES_SECRET=$(openssl rand -hex 32)
DEMO_SECRET=$(openssl rand -hex 32)

cat > /opt/elevator-erp/.env <<EOF
POSTGRES_DB=elevator_erp
POSTGRES_USER=elevator
POSTGRES_PASSWORD=${POSTGRES_SECRET}
DEMO_DEFAULT_PASSWORD=${DEMO_SECRET}
ENABLE_DEMO_SEED=false
NEXT_PUBLIC_API_BASE_URL=/api
CORS_ALLOWED_ORIGINS=http://${IP_SERVER}
GOOGLE_MAPS_API_KEY=
POSTGRES_DATA_PATH=/opt/elevator-erp/data/postgres
REDIS_DATA_PATH=/opt/elevator-erp/data/redis
UPLOADS_PATH=/opt/elevator-erp/data/uploads
DATA_PROTECTION_KEYS_PATH=/opt/elevator-erp/data/data-protection-keys
EOF

unset POSTGRES_SECRET DEMO_SECRET
chmod 600 /opt/elevator-erp/.env
grep -Ev 'PASSWORD|KEY' /opt/elevator-erp/.env
```

Lưu ý: `.env` là cấu hình riêng của VPS, không đưa vào Git. Khi có domain và HTTPS, đổi `CORS_ALLOWED_ORIGINS` thành `https://<DOMAIN>`.

### A10. Khởi động database và restore dữ liệu

- [ ] Chạy PostgreSQL và Redis trước:

```bash
cd /opt/elevator-erp
docker compose up -d postgres redis
docker compose ps
```

Chờ đến khi PostgreSQL và Redis có trạng thái `healthy`.

- [ ] Restore database local lên VPS:

```bash
cd /opt/elevator-erp
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U elevator -d elevator_erp < elevator-erp-db.sql
```

Lệnh hoàn thành khi không có `ERROR` và quay lại dấu nhắc lệnh.

- [ ] Restore uploads và Data Protection Keys:

```bash
cd /opt/elevator-erp
tar -xzf elevator-erp-files.tar.gz -C data
chmod 700 data/data-protection-keys
find data/uploads -type f | wc -l
find data/data-protection-keys -type f | wc -l
```

### A11. Build và khởi động toàn bộ ERP

> Docker sẽ build frontend/backend trên VPS. Việc này có thể mất vài phút ở lần đầu.

- [ ] Chạy trên VPS:

```bash
cd /opt/elevator-erp
docker compose up -d --build
docker compose ps
```

Kết quả cần thấy:

- `postgres`, `redis`: `healthy`.
- `backend`, `frontend`, `nginx`: `Up`.
- Nginx có cổng `0.0.0.0:80->80/tcp`.

### A12. Kiểm tra website

- [ ] Kiểm tra ngay trên VPS:

```bash
curl -I http://127.0.0.1/
```

- [ ] Mở từ máy local:

```text
http://<IP_SERVER>
```

- [ ] Kiểm tra đăng nhập, dữ liệu cũ, ảnh/tài liệu đính kèm và một thao tác lưu dữ liệu.

### A13. Dọn file triển khai tạm

> Chỉ làm sau khi website và dữ liệu đã được kiểm tra thành công.

```bash
cd /opt/elevator-erp
rm -f elevator-erp-source.tar.gz elevator-erp-db.sql elevator-erp-files.tar.gz
```

---

## 3. Checklist B — Thiết lập Git một lần cho cập nhật code

> Thực hiện sau khi có source local. Git chỉ lưu code/tài liệu; không lưu `.env` và dữ liệu runtime.

### B1. Kiểm tra file bị loại trừ khỏi Git

- [ ] Trong `.gitignore` phải có tối thiểu:

```gitignore
.env
.data/
frontend/node_modules/
frontend/.next/
**/bin/
**/obj/
```

### B2. Khởi tạo và đẩy source local lên GitHub

- [ ] Chạy trên Windows PowerShell:

```powershell
Set-Location 'D:\PROJECT\ElevatorERP_FullMenu_UI'
git init -b main
git status
git add .
git status
git commit -m "Initial ERP source"
```

- [ ] Tạo repository **Private** trên GitHub, không tạo README, `.gitignore` hoặc license trên GitHub.

- [ ] Thêm remote và đẩy code. Thay `<GITHUB_REPOSITORY_URL>` bằng URL SSH/HTTPS của repository.

```powershell
git remote add origin <GITHUB_REPOSITORY_URL>
git push -u origin main
```

### B3. Thiết lập VPS nhận code từ GitHub

> Chỉ cần làm một lần. Có thể dùng Deploy Key chỉ có quyền đọc.

- [ ] Trên VPS, tạo SSH key:

```bash
ssh-keygen -t ed25519 -C "elevator-erp-vps" -f /root/.ssh/elevator-erp_deploy -N ""
cat /root/.ssh/elevator-erp_deploy.pub
```

- [ ] Copy dòng public key, vào GitHub repository → **Settings → Deploy keys → Add deploy key**, dán key và chỉ cho phép read-only.

- [ ] Cấu hình SSH trên VPS:

```bash
mkdir -p /root/.ssh
chmod 700 /root/.ssh
ssh-keyscan -H github.com >> /root/.ssh/known_hosts

cat > /root/.ssh/config <<'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile /root/.ssh/elevator-erp_deploy
  IdentitiesOnly yes
EOF

chmod 600 /root/.ssh/config
ssh -T git@github.com
```

Kết quả cần thấy: GitHub xác thực thành công và báo không cung cấp shell access.

### B4. Chuyển source VPS hiện có sang nhận cập nhật bằng Git

> Sao lưu `.env` và `data/` trước. Không chạy `git clean`; lệnh này có thể xóa dữ liệu chưa được theo dõi. `git reset --hard` bên dưới chỉ thay thế các file source đã được Git quản lý; `.env` và `data/` là dữ liệu riêng nên không bị thay thế.

```bash
cd /opt/elevator-erp
cp .env /root/elevator-erp.env.before-git
tar -czf /root/elevator-erp-data-before-git.tar.gz data
git init -b main
git remote add origin <GITHUB_REPOSITORY_SSH_URL>
git fetch origin main
git reset --hard origin/main
git branch --set-upstream-to=origin/main main
git status
```

Kết quả cần thấy: branch `main` theo dõi `origin/main`; `.env` và `data/` vẫn còn. Từ lần cập nhật tiếp theo dùng `git pull --ff-only` theo Checklist C.

---

## 4. Checklist C — Cập nhật code hằng ngày

> Dùng khi chỉ thay đổi code, giao diện hoặc tài liệu. Không động vào database/uploads nếu không cần đồng bộ dữ liệu test.

### C1. Đẩy code từ local lên GitHub

- [ ] Chạy trên Windows PowerShell:

```powershell
Set-Location 'D:\PROJECT\ElevatorERP_FullMenu_UI'
git status
git add .
git status
git commit -m "Mo ta thay doi"
git push
```

Trước khi `git add .`, kiểm tra `.env` và `.data/` không nằm trong phần staged.

### C2. Cập nhật code và chạy lại trên VPS

- [ ] SSH vào VPS:

```powershell
ssh root@<IP_SERVER>
```

- [ ] Chạy trên VPS:

```bash
cd /opt/elevator-erp
git pull --ff-only
docker compose up -d --build
docker compose ps
```

- [ ] Kiểm tra website tại:

```text
http://<IP_SERVER>
```

### C3. Khi thay đổi chỉ ở backend

```bash
cd /opt/elevator-erp
git pull --ff-only
docker compose up -d --build backend nginx
docker compose ps
```

### C4. Khi thay đổi chỉ ở frontend

```bash
cd /opt/elevator-erp
git pull --ff-only
docker compose up -d --build frontend nginx
docker compose ps
```

---

## 5. Checklist D — Đồng bộ dữ liệu local lên VPS trong giai đoạn test

> Chỉ làm khi cần VPS giống local. **Database VPS sẽ bị thay bằng database local.** Không dùng luồng này sau khi có người dùng nhập dữ liệu thật trên VPS.

### D1. Export database local

```powershell
Set-Location 'D:\PROJECT\ElevatorERP_FullMenu_UI'
$postgresContainer = (docker compose ps -q postgres).Trim()

if ([string]::IsNullOrWhiteSpace($postgresContainer)) {
  throw 'Không tìm thấy PostgreSQL local. Hãy khởi động Docker Compose local trước.'
}

docker exec $postgresContainer sh -c "pg_dump -U elevator -d elevator_erp --clean --if-exists --no-owner --no-privileges -f /tmp/elevator_erp.sql"
docker cp "$($postgresContainer):/tmp/elevator_erp.sql" 'D:\PROJECT\elevator-erp-db.sql'
docker exec $postgresContainer rm -f /tmp/elevator_erp.sql
Get-Item 'D:\PROJECT\elevator-erp-db.sql'
```

### D2. Nén uploads và Data Protection Keys local

```powershell
tar -czf D:\PROJECT\elevator-erp-files.tar.gz `
  -C D:\PROJECT\ElevatorERP_FullMenu_UI\.data `
  uploads data-protection-keys

Get-Item D:\PROJECT\elevator-erp-files.tar.gz
```

### D3. Upload database và file runtime lên VPS

```powershell
scp D:\PROJECT\elevator-erp-db.sql D:\PROJECT\elevator-erp-files.tar.gz root@<IP_SERVER>:/opt/elevator-erp/
```

### D4. Restore trên VPS

```bash
cd /opt/elevator-erp
docker compose stop backend frontend nginx
docker compose up -d postgres redis
docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U elevator -d elevator_erp < elevator-erp-db.sql
tar -xzf elevator-erp-files.tar.gz -C data
chmod 700 data/data-protection-keys
docker compose up -d backend frontend nginx
docker compose ps
```

### D5. Kiểm tra đồng bộ

- [ ] Đăng nhập VPS bằng tài khoản giống local.
- [ ] So sánh số lượng khách hàng/đăng ký tư vấn ở local và VPS.
- [ ] Mở ít nhất một ảnh/tài liệu đính kèm.
- [ ] Nếu không cần giữ file upload cũ trên VPS, có thể kiểm tra số file:

```bash
find /opt/elevator-erp/data/uploads -type f | wc -l
find /opt/elevator-erp/data/data-protection-keys -type f | wc -l
```

---

## 6. Checklist E — Kiểm tra, log và sao lưu

### E1. Kiểm tra trạng thái các container

```bash
cd /opt/elevator-erp
docker compose ps
```

### E2. Xem log khi website lỗi

```bash
cd /opt/elevator-erp
docker compose logs --tail=100 backend frontend nginx
```

Theo dõi log liên tục:

```bash
cd /opt/elevator-erp
docker compose logs -f backend frontend nginx
```

Dừng theo dõi bằng `Ctrl + C`.

### E3. Khởi động lại toàn bộ hệ thống

```bash
cd /opt/elevator-erp
docker compose restart
docker compose ps
```

### E4. Sao lưu database trên VPS

> Nên thực hiện trước các thay đổi lớn và thiết lập lịch sao lưu định kỳ khi chạy thật.

```bash
cd /opt/elevator-erp
mkdir -p backups
docker compose exec -T postgres pg_dump -U elevator -d elevator_erp --clean --if-exists --no-owner --no-privileges > backups/elevator_erp_$(date +%F_%H%M%S).sql
ls -lh backups
```

### E5. Sao lưu uploads và Data Protection Keys trên VPS

```bash
cd /opt/elevator-erp
tar -czf backups/elevator_erp_files_$(date +%F_%H%M%S).tar.gz -C data uploads data-protection-keys
ls -lh backups
```

### E6. Chuẩn bị HTTPS khi có tên miền

- [ ] Trỏ DNS bản ghi `A` của `<DOMAIN>` về `<IP_SERVER>`.
- [ ] Xác nhận HTTP hoạt động trước.
- [ ] Cấu hình SSL/HTTPS và đổi `CORS_ALLOWED_ORIGINS=https://<DOMAIN>` trong `/opt/elevator-erp/.env`.
- [ ] Chạy lại:

```bash
cd /opt/elevator-erp
docker compose up -d --build
```

---

## Xác nhận hoàn tất triển khai

- [ ] `docker compose ps` có đủ `postgres`, `redis`, `backend`, `frontend`, `nginx`.
- [ ] PostgreSQL và Redis là `healthy`.
- [ ] Website mở được bằng `http://<IP_SERVER>` hoặc `https://<DOMAIN>`.
- [ ] Đăng nhập thành công.
- [ ] Dữ liệu database, uploads và Data Protection Keys đã kiểm tra.
- [ ] `.env` có quyền `600`, không xuất hiện trên GitHub.
- [ ] Có file backup database trước khi đưa hệ thống vào vận hành thật.
