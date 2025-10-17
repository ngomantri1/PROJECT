using System;

namespace ABX.Core
{
    public interface ILogService
    {
        void Info(string message);
        void Warn(string message);
        void Error(string message);

        // Thêm 2 overload sau để tiện log lỗi có Exception
        void Error(Exception ex);
        void Error(string message, Exception ex);
    }
}
