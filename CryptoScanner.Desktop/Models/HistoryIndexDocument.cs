namespace CryptoScanner.Desktop.Models;

public sealed class HistoryIndexDocument
{
 public string SchemaVersion { get; set; } = "1.0";
 public DateTimeOffset UpdatedAt { get; set; }
 public List<HistoryIndexEntry> Entries { get; set; } = [];
}
