using ElevatorERP.Domain;
using ElevatorERP.Security;
using Microsoft.EntityFrameworkCore;

namespace ElevatorERP.Infrastructure;

public static class DemoSeeder
{
    public static async Task SeedAsync(AppDbContext db, IConfiguration config)
    {
        await db.Database.EnsureCreatedAsync();

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
        var directorRole = CreateRole("DIRECTOR","Giám đốc","ALL", "dashboard.view","customer.view","care.view","audit.view");
        var salesRole = CreateRole("SALES","Nhân viên kinh doanh","OWN", "dashboard.view","customer.view","customer.create","customer.update","care.view","care.create","care.update","file.upload");
        var salesManagerRole = CreateRole("SALES_MANAGER","Trưởng phòng kinh doanh","DEPARTMENT", "dashboard.view","customer.view","customer.create","customer.update","care.view","care.create","care.update","file.upload");
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
                Area=i%3==0?"Thanh Hóa":i%3==1?"Nghệ An":"Hà Nội", Source=sources[i%sources.Length],
                Status=i%5==0?"NEGOTIATING":i%4==0?"QUOTED":"CARING", OwnerUser=i%3==0?salesManager:sales, IsDemo=true
            });
        }
        db.Customers.AddRange(customers);
        await db.SaveChangesAsync();

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
}
