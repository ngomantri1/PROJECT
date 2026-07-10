using System.Threading;
using System.Threading.Tasks;
using TaiXiuMD5Hit.Tasks;

namespace TaiXiuMD5Hit.Tasks
{
    public interface IBetTask
    {
        string Id { get; }           // mã task
        string DisplayName { get; }  // tên hiển thị
        Task RunAsync(GameContext ctx, CancellationToken ct);
    }
}
