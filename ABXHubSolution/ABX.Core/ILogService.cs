namespace ABX.Core
{
    /// <summary>
    /// Chỉ log chuỗi. Nếu có Exception, bên gọi tự nối ex.ToString() vào message.
    /// Mục tiêu: tránh giữ tham chiếu Exception qua ranh giới Hub↔Plugin để ALC unload sạch.
    /// </summary>
    public interface ILogService
    {
        void Info(string message);
        void Warn(string message);
        void Error(string message);
    }
}
