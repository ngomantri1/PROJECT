using ElevatorERP.Domain;
using ElevatorERP.Security;
using Microsoft.EntityFrameworkCore;

namespace ElevatorERP.Infrastructure;

public static class DemoSeeder
{
    public static async Task SeedAsync(AppDbContext db, IConfiguration config)
    {
        await db.Database.EnsureCreatedAsync();
        await EnsureCustomerLocationColumnsAsync(db);
        await EnsureCatalogTablesAsync(db);
        await EnsureConsultationProfileTablesAsync(db);
        await EnsureQuotationTablesAsync(db);
        await EnsureCustomerElevatorTablesAsync(db);
        await BackfillConsultationProfilesAsync(db);
        await SeedCatalogsAsync(db);
        await EnsureCustomerDeletePermissionAsync(db);

        var enableDemo = bool.TryParse(config["EnableDemoSeed"], out var demo) && demo;
        if (!enableDemo || await db.Users.AnyAsync()) return;

        var departments = new[]
        {
            new Department { Code="BGD", Name="Ban giám đốc" },
            new Department { Code="KD", Name="Phòng kinh doanh" },
            new Department { Code="KT", Name="Phòng kỹ thuật" },
            new Department { Code="DH", Name="Phòng điều hành" },
            new Department { Code="KTOAN", Name="Phòng kế toán" },
            new Department { Code="NS", Name="Phòng nhân sự" }
        };
        db.Departments.AddRange(departments);

        var permissionDefs = new (string Code,string Name,string Module)[]
        {
            ("dashboard.view","Xem tổng quan","Dashboard"),
            ("customer.view","Xem đăng ký khách hàng","Customers"),
            ("customer.create","Tạo đăng ký khách hàng","Customers"),
            ("customer.update","Sửa đăng ký khách hàng","Customers"),
            ("customer.delete","Xóa khách hàng","Customers"),
            ("care.view","Xem lịch chăm sóc","Care"),
            ("care.create","Tạo lịch chăm sóc","Care"),
            ("care.update","Cập nhật lịch chăm sóc","Care"),
            ("user.manage","Quản lý người dùng","Administration"),
            ("role.manage","Quản lý vai trò và quyền","Administration"),
            ("audit.view","Xem nhật ký hệ thống","Administration"),
            ("file.upload","Tải file lên","Documents")
        };
        var permissions = permissionDefs.Select(x => new Permission { Code=x.Code, Name=x.Name, Module=x.Module }).ToList();
        db.Permissions.AddRange(permissions);

        Role CreateRole(string code,string name,string scope, params string[] pcs)
        {
            var role = new Role { Code=code, Name=name, DataScope=scope };
            foreach (var pc in permissions.Where(p => pcs.Contains(p.Code))) role.RolePermissions.Add(new RolePermission { Role=role, Permission=pc });
            return role;
        }

        var allCodes = permissions.Select(x=>x.Code).ToArray();
        var adminRole = CreateRole("SYS_ADMIN","Quản trị hệ thống","ALL", allCodes);
        var directorRole = CreateRole("DIRECTOR","Giám đốc","ALL", "dashboard.view","customer.view","customer.delete","care.view","audit.view");
        var salesRole = CreateRole("SALES","Nhân viên kinh doanh","OWN", "dashboard.view","customer.view","customer.create","customer.update","care.view","care.create","care.update","file.upload");
        var salesManagerRole = CreateRole("SALES_MANAGER","Trưởng phòng kinh doanh","DEPARTMENT", "dashboard.view","customer.view","customer.create","customer.update","customer.delete","care.view","care.create","care.update","file.upload");
        var technicalRole = CreateRole("TECHNICIAN","Kỹ thuật viên","ASSIGNED", "dashboard.view","file.upload");
        var accountantRole = CreateRole("ACCOUNTANT","Kế toán viên","ASSIGNED", "dashboard.view");
        db.Roles.AddRange(adminRole,directorRole,salesRole,salesManagerRole,technicalRole,accountantRole);

        var pwd = config["DemoDefaultPassword"] ?? "Demo@123456";
        AppUser U(string username,string name,string email,Department dep, params Role[] roles)
        {
            var u = new AppUser { Username=username, DisplayName=name, Email=email, Department=dep, PasswordHash=PasswordService.Hash(pwd), IsDemo=true };
            foreach(var r in roles) u.UserRoles.Add(new UserRole { User=u, Role=r });
            return u;
        }
        var admin = U("admin.demo","Phạm Xuân Tùng","admin@demo.local",departments[0],adminRole,directorRole);
        var sales = U("sales.demo","Lê Văn Hoàng","sales@demo.local",departments[1],salesRole);
        var salesManager = U("salesmanager.demo","Lưu Sỹ Dương","salesmanager@demo.local",departments[1],salesManagerRole);
        var technical = U("technical.demo","Đào Hoàng Anh","technical@demo.local",departments[2],technicalRole);
        var accountant = U("accountant.demo","Nguyễn Thị Mai","accountant@demo.local",departments[4],accountantRole);
        db.Users.AddRange(admin,sales,salesManager,technical,accountant);
        await db.SaveChangesAsync();

        var names = new[] {"Anh Khải","Anh Hùng","Chị Lan","Công ty Hoàng Long","Khách sạn Mường Thanh","Công ty Minh Phát","Anh Đức","Chị Hương","Công ty Thành Công","Anh Sơn","Chị Hà","Công ty An Phú","Anh Nam","Chị Linh","Công ty Đại Việt","Anh Cường","Chị Mai","Công ty Hòa Bình","Anh Tuấn","Công ty Phú Gia"};
        var sources = new[] {"Marketing","Giới thiệu","Telesale","Cộng tác viên","Khách cũ"};
        var random = new Random(20260716);
        var customers = new List<Customer>();
        for(int i=0;i<names.Length;i++)
        {
            customers.Add(new Customer
            {
                Code=$"KH-{i+1:0000}", Name=names[i], Phone=$"09{random.Next(10000000,99999999)}",
                Email=$"customer{i+1}@example.com", Address=$"Địa chỉ công trình số {i+1}, Thanh Hóa",
                Area=null, ElevatorType=i%2==0?"BUILT":"GLASS", Source=sources[i%sources.Length],
                Status=i%5==0?"NEGOTIATING":i%4==0?"QUOTED":"CARING", OwnerUser=i%3==0?salesManager:sales, IsDemo=true
            });
        }
        db.Customers.AddRange(customers);
        await db.SaveChangesAsync();
        await BackfillConsultationProfilesAsync(db);

        var careTypes = new[] {"CALL","MEETING","SURVEY","SEND_QUOTE","FOLLOW_UP"};
        for(int i=0;i<45;i++)
        {
            var date = DateTimeOffset.UtcNow.AddDays(random.Next(-20,21)).AddHours(random.Next(1,8));
            db.CareActivities.Add(new CareActivity
            {
                Customer=customers[random.Next(customers.Count)], AssigneeUser=i%4==0?salesManager:sales,
                CareType=careTypes[i%careTypes.Length], ScheduledAt=date,
                Content=i%3==0?"Khảo sát nhu cầu lắp thang máy":i%3==1?"Gọi điện tư vấn và xác nhận thông tin":"Theo dõi phản hồi báo giá",
                Result=date < DateTimeOffset.UtcNow && i%4!=0?"Đã liên hệ, khách hẹn trao đổi thêm":"",
                Status=date < DateTimeOffset.UtcNow ? (i%4==0?"OVERDUE":"DONE") : "UPCOMING",
                NextCareAt=date < DateTimeOffset.UtcNow ? date.AddDays(7) : null, IsDemo=true
            });
        }
        await db.SaveChangesAsync();
    }

    private static async Task EnsureCustomerDeletePermissionAsync(AppDbContext db)
    {
        if (!await db.Users.AnyAsync() || await db.Permissions.AnyAsync(x => x.Code == "customer.delete")) return;

        var permission = new Permission
        {
            Code = "customer.delete",
            Name = "Xóa khách hàng",
            Module = "Customers"
        };
        db.Permissions.Add(permission);

        var managerRoles = await db.Roles
            .Where(x => x.Code == "SYS_ADMIN" || x.Code == "DIRECTOR" || x.Code == "SALES_MANAGER")
            .ToListAsync();
        foreach (var role in managerRoles)
            db.RolePermissions.Add(new RolePermission { RoleId = role.Id, Permission = permission });

        await db.SaveChangesAsync();
    }

    private static async Task EnsureCatalogTablesAsync(AppDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "CatalogCategories" (
                "Id" uuid NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NULL,
                "IsDeleted" boolean NOT NULL,
                "IsDemo" boolean NOT NULL,
                "Code" text NOT NULL,
                "Name" text NOT NULL,
                "Module" text NOT NULL,
                "Description" text NULL,
                "SortOrder" integer NOT NULL,
                "IsSystem" boolean NOT NULL,
                "IsActive" boolean NOT NULL,
                CONSTRAINT "PK_CatalogCategories" PRIMARY KEY ("Id")
            );

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CatalogCategories_Code"
                ON "CatalogCategories" ("Code");

            CREATE TABLE IF NOT EXISTS "CatalogOptions" (
                "Id" uuid NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NULL,
                "IsDeleted" boolean NOT NULL,
                "IsDemo" boolean NOT NULL,
                "CategoryId" uuid NOT NULL,
                "Code" text NOT NULL,
                "Label" text NOT NULL,
                "Description" text NULL,
                "Color" text NULL,
                "SortOrder" integer NOT NULL,
                "IsSystem" boolean NOT NULL,
                "IsActive" boolean NOT NULL,
                CONSTRAINT "PK_CatalogOptions" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_CatalogOptions_CatalogCategories_CategoryId"
                    FOREIGN KEY ("CategoryId") REFERENCES "CatalogCategories" ("Id") ON DELETE RESTRICT
            );

            CREATE INDEX IF NOT EXISTS "IX_CatalogOptions_CategoryId"
                ON "CatalogOptions" ("CategoryId");

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CatalogOptions_CategoryId_Code"
                ON "CatalogOptions" ("CategoryId", "Code");
            """);
    }

    private static async Task EnsureCustomerLocationColumnsAsync(AppDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "Customers"
                ADD COLUMN IF NOT EXISTS "Latitude" double precision NULL,
                ADD COLUMN IF NOT EXISTS "Longitude" double precision NULL,
                ADD COLUMN IF NOT EXISTS "LocationAccuracyMeters" double precision NULL,
                ADD COLUMN IF NOT EXISTS "LocationLabel" text NULL,
                ADD COLUMN IF NOT EXISTS "ElevatorType" text NULL,
                ADD COLUMN IF NOT EXISTS "TechnicalSpecsJson" text NULL,
                ADD COLUMN IF NOT EXISTS "AttachmentLinksJson" text NULL;
            """);
    }

    private static async Task EnsureQuotationTablesAsync(AppDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "Quotations" (
                "Id" uuid NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NULL,
                "IsDeleted" boolean NOT NULL,
                "IsDemo" boolean NOT NULL,
                "Code" text NOT NULL,
                "CustomerId" uuid NOT NULL,
                "ConsultationProfileId" uuid NULL,
                "OwnerUserId" uuid NOT NULL,
                "Title" text NOT NULL,
                "VersionNo" integer NOT NULL,
                "Status" text NOT NULL,
                "ValidUntil" timestamp with time zone NULL,
                "ElevatorSpecsJson" text NULL,
                "CostLinesJson" text NULL,
                "SubtotalAmount" numeric NOT NULL,
                "DiscountAmount" numeric NOT NULL,
                "VatRate" numeric NOT NULL,
                "VatAmount" numeric NOT NULL,
                "TotalAmount" numeric NOT NULL,
                "Notes" text NULL,
                "SentAt" timestamp with time zone NULL,
                "ApprovedAt" timestamp with time zone NULL,
                CONSTRAINT "PK_Quotations" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_Quotations_Customers_CustomerId"
                    FOREIGN KEY ("CustomerId") REFERENCES "Customers" ("Id") ON DELETE RESTRICT,
                CONSTRAINT "FK_Quotations_Users_OwnerUserId"
                    FOREIGN KEY ("OwnerUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
            );

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_Quotations_Code"
                ON "Quotations" ("Code");

            CREATE INDEX IF NOT EXISTS "IX_Quotations_CustomerId"
                ON "Quotations" ("CustomerId");

            ALTER TABLE "Quotations"
                ADD COLUMN IF NOT EXISTS "ConsultationProfileId" uuid NULL;

            CREATE INDEX IF NOT EXISTS "IX_Quotations_ConsultationProfileId"
                ON "Quotations" ("ConsultationProfileId");

            CREATE INDEX IF NOT EXISTS "IX_Quotations_OwnerUserId"
                ON "Quotations" ("OwnerUserId");

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_Quotations_ConsultationProfiles_ConsultationProfileId'
                ) THEN
                    ALTER TABLE "Quotations"
                    ADD CONSTRAINT "FK_Quotations_ConsultationProfiles_ConsultationProfileId"
                    FOREIGN KEY ("ConsultationProfileId") REFERENCES "ConsultationProfiles" ("Id") ON DELETE RESTRICT;
                END IF;
            END $$;
            """);
    }

    private static async Task EnsureConsultationProfileTablesAsync(AppDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "ConsultationProfiles" (
                "Id" uuid NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NULL,
                "IsDeleted" boolean NOT NULL,
                "IsDemo" boolean NOT NULL,
                "Code" text NOT NULL,
                "CustomerId" uuid NOT NULL,
                "ProfileType" text NOT NULL,
                "Source" text NOT NULL,
                "Status" text NOT NULL,
                "OwnerUserId" uuid NOT NULL,
                "ProjectAddress" text NULL,
                "Area" text NULL,
                "ElevatorType" text NULL,
                "Latitude" double precision NULL,
                "Longitude" double precision NULL,
                "LocationAccuracyMeters" double precision NULL,
                "LocationLabel" text NULL,
                "Notes" text NULL,
                "TechnicalSpecsJson" text NULL,
                "AttachmentLinksJson" text NULL,
                "IsKpiEligible" boolean NOT NULL,
                "KpiCountedAt" timestamp with time zone NULL,
                "KpiExcludedReason" text NULL,
                CONSTRAINT "PK_ConsultationProfiles" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_ConsultationProfiles_Customers_CustomerId"
                    FOREIGN KEY ("CustomerId") REFERENCES "Customers" ("Id") ON DELETE RESTRICT,
                CONSTRAINT "FK_ConsultationProfiles_Users_OwnerUserId"
                    FOREIGN KEY ("OwnerUserId") REFERENCES "Users" ("Id") ON DELETE RESTRICT
            );

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_ConsultationProfiles_Code"
                ON "ConsultationProfiles" ("Code");

            CREATE INDEX IF NOT EXISTS "IX_ConsultationProfiles_CustomerId"
                ON "ConsultationProfiles" ("CustomerId");

            CREATE INDEX IF NOT EXISTS "IX_ConsultationProfiles_OwnerUserId"
                ON "ConsultationProfiles" ("OwnerUserId");
            """);
    }

    private static async Task EnsureCustomerElevatorTablesAsync(AppDbContext db)
    {
        await db.Database.ExecuteSqlRawAsync("""
            CREATE TABLE IF NOT EXISTS "CustomerElevators" (
                "Id" uuid NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "UpdatedAt" timestamp with time zone NULL,
                "IsDeleted" boolean NOT NULL,
                "IsDemo" boolean NOT NULL,
                "Code" text NOT NULL,
                "CustomerId" uuid NOT NULL,
                "ConsultationProfileId" uuid NULL,
                "SourceQuotationId" uuid NULL,
                "ContractReference" text NULL,
                "Name" text NOT NULL,
                "ElevatorType" text NOT NULL,
                "TechnicalSpecsJson" text NOT NULL,
                "InstallationAddress" text NULL,
                "Area" text NULL,
                "Latitude" double precision NULL,
                "Longitude" double precision NULL,
                "LocationLabel" text NULL,
                "Status" text NOT NULL,
                "SignedAt" timestamp with time zone NULL,
                "HandedOverAt" timestamp with time zone NULL,
                "WarrantyExpiresAt" timestamp with time zone NULL,
                CONSTRAINT "PK_CustomerElevators" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_CustomerElevators_Customers_CustomerId"
                    FOREIGN KEY ("CustomerId") REFERENCES "Customers" ("Id") ON DELETE RESTRICT,
                CONSTRAINT "FK_CustomerElevators_ConsultationProfiles_ConsultationProfileId"
                    FOREIGN KEY ("ConsultationProfileId") REFERENCES "ConsultationProfiles" ("Id") ON DELETE RESTRICT,
                CONSTRAINT "FK_CustomerElevators_Quotations_SourceQuotationId"
                    FOREIGN KEY ("SourceQuotationId") REFERENCES "Quotations" ("Id") ON DELETE RESTRICT
            );

            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CustomerElevators_Code"
                ON "CustomerElevators" ("Code");
            CREATE INDEX IF NOT EXISTS "IX_CustomerElevators_CustomerId"
                ON "CustomerElevators" ("CustomerId");
            CREATE INDEX IF NOT EXISTS "IX_CustomerElevators_ConsultationProfileId"
                ON "CustomerElevators" ("ConsultationProfileId");
            CREATE INDEX IF NOT EXISTS "IX_CustomerElevators_SourceQuotationId"
                ON "CustomerElevators" ("SourceQuotationId");
            """);
    }

    private static async Task BackfillConsultationProfilesAsync(AppDbContext db)
    {
        var customers = await db.Customers
            .IgnoreQueryFilters()
            .Where(customer => !customer.IsDeleted)
            .ToListAsync();
        if (customers.Count == 0) return;

        var existingCustomerIds = await db.ConsultationProfiles
            .IgnoreQueryFilters()
            .Select(profile => profile.CustomerId)
            .Distinct()
            .ToListAsync();
        var existingSet = existingCustomerIds.ToHashSet();
        var count = await db.ConsultationProfiles.IgnoreQueryFilters().CountAsync();

        foreach (var customer in customers.Where(customer => !existingSet.Contains(customer.Id)))
        {
            count++;
            db.ConsultationProfiles.Add(new ConsultationProfile
            {
                Code = $"HSTV-{count:000000}",
                CustomerId = customer.Id,
                ProfileType = "NEW_CUSTOMER",
                Source = customer.Source,
                Status = customer.Status,
                OwnerUserId = customer.OwnerUserId,
                ProjectAddress = customer.Address,
                Area = customer.Area,
                ElevatorType = customer.ElevatorType,
                Latitude = customer.Latitude,
                Longitude = customer.Longitude,
                LocationAccuracyMeters = customer.LocationAccuracyMeters,
                LocationLabel = customer.LocationLabel,
                Notes = customer.Notes,
                TechnicalSpecsJson = customer.TechnicalSpecsJson,
                AttachmentLinksJson = customer.AttachmentLinksJson,
                IsKpiEligible = customer.Status != "LOST",
                KpiCountedAt = customer.CreatedAt,
                IsDemo = customer.IsDemo,
                CreatedAt = customer.CreatedAt,
                UpdatedAt = customer.UpdatedAt
            });
        }

        await db.SaveChangesAsync();

        await db.Database.ExecuteSqlRawAsync("""
            UPDATE "Quotations" q
            SET "ConsultationProfileId" = p."Id"
            FROM "ConsultationProfiles" p
            WHERE q."ConsultationProfileId" IS NULL
              AND q."CustomerId" = p."CustomerId"
              AND p."IsDeleted" = false;
            """);
    }

    private static async Task SeedCatalogsAsync(AppDbContext db)
    {
        async Task<CatalogCategory> Category(string code, string name, string module, string description, int sortOrder)
        {
            var category = await db.CatalogCategories.FirstOrDefaultAsync(x => x.Code == code);
            if (category is not null) return category;

            category = new CatalogCategory
            {
                Code = code,
                Name = name,
                Module = module,
                Description = description,
                SortOrder = sortOrder,
                IsSystem = true,
                IsActive = true
            };
            db.CatalogCategories.Add(category);
            return category;
        }

        static CatalogOption Option(CatalogCategory category, string code, string label, string color, int sortOrder, bool isSystem = true) =>
            new()
            {
                Category = category,
                Code = code,
                Label = label,
                Color = color,
                SortOrder = sortOrder,
                IsSystem = isSystem,
                IsActive = true
            };

        var customerStatus = await Category("customer_status", "Trạng thái khách hàng", "Customers", "Trạng thái hồ sơ đăng ký/nhu cầu khách hàng.", 10);
        var lostReason = await Category("customer_lost_reason", "Lý do mất khách", "Customers", "Lý do khi hồ sơ khách hàng không thành công.", 20);
        var customerSource = await Category("customer_source", "Nguồn khách hàng", "Customers", "Nguồn phát sinh khách hàng.", 30);
        var customerType = await Category("customer_type", "Loại khách hàng", "Customers", "Phân loại cá nhân/doanh nghiệp.", 40);
        var elevatorType = await Category("elevator_type", "Loại thang", "Elevators", "Phân loại dòng thang máy để dùng chung trong đăng ký, báo giá, dự án và hồ sơ thang.", 50);

        var options = new[]
        {
            Option(customerStatus, "NEW", "Mới tiếp nhận", "blue", 10),
            Option(customerStatus, "CONTACTED", "Đã liên hệ", "cyan", 20),
            Option(customerStatus, "CARING", "Đang chăm sóc", "green", 30),
            Option(customerStatus, "WAITING_SURVEY", "Chờ khảo sát", "purple", 40),
            Option(customerStatus, "SURVEYED", "Đã khảo sát", "purple", 50),
            Option(customerStatus, "VISITED_SHOWROOM", "Đã xem thang mẫu", "geekblue", 60),
            Option(customerStatus, "QUOTED", "Đã gửi báo giá", "cyan", 70),
            Option(customerStatus, "WAITING_RESPONSE", "Chờ phản hồi", "orange", 80),
            Option(customerStatus, "NEGOTIATING", "Đang đàm phán", "orange", 90),
            Option(customerStatus, "CONVERTED", "Đã chuyển sang hợp đồng", "green", 100),
            Option(customerStatus, "PAUSED", "Tạm dừng chăm sóc", "default", 110),
            Option(customerStatus, "LOST", "Không thành công", "red", 120),

            Option(lostReason, "SIGNED_WITH_COMPETITOR", "Đã ký với đơn vị khác", "red", 10),
            Option(lostReason, "PRICE_NOT_MATCH", "Giá không phù hợp", "orange", 20),
            Option(lostReason, "NO_DEMAND", "Không còn nhu cầu", "default", 30),
            Option(lostReason, "CANNOT_CONTACT", "Không liên hệ được", "gold", 40),
            Option(lostReason, "TECHNICAL_NOT_FIT", "Không phù hợp kỹ thuật", "purple", 50),
            Option(lostReason, "CUSTOMER_DELAY", "Khách tạm hoãn", "cyan", 60),
            Option(lostReason, "OTHER", "Khác", "default", 70),

            Option(customerSource, "MARKETING", "Marketing", "green", 10),
            Option(customerSource, "REFERRAL", "Giới thiệu", "cyan", 20),
            Option(customerSource, "TELESALE", "Telesale", "blue", 30),
            Option(customerSource, "OLD_CUSTOMER", "Khách cũ", "purple", 40),
            Option(customerSource, "PARTNER", "Cộng tác viên", "gold", 50),
            Option(customerSource, "OTHER", "Khác", "default", 60, false),

            Option(customerType, "PERSONAL", "Cá nhân", "green", 10),
            Option(customerType, "BUSINESS", "Doanh nghiệp", "blue", 20),

            Option(elevatorType, "BUILT", "Thang xây", "green", 10),
            Option(elevatorType, "GLASS", "Thang kính", "blue", 20)
        };

        foreach (var option in options)
        {
            var existing = await db.CatalogOptions.FirstOrDefaultAsync(x =>
                x.Category.Code == option.Category.Code && x.Code == option.Code);
            if (existing is null)
            {
                db.CatalogOptions.Add(option);
                continue;
            }

            if (!option.IsSystem) continue;

            existing.Label = option.Label;
            existing.Color = option.Color;
            existing.SortOrder = option.SortOrder;
            existing.IsSystem = true;
            existing.IsActive = true;
        }

        await db.SaveChangesAsync();
    }
}
