using System.Threading;
using System.Threading.Tasks;
using BaccaratDG.Tasks;

namespace BaccaratDG.Tasks
{
    public interface IBetTask
    {
        string Id { get; }           // mã task
        string DisplayName { get; }  // tên hiển thị
        Task RunAsync(GameContext ctx, CancellationToken ct);
    }
}
