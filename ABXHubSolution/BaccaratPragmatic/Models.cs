using System;
using System.Windows.Media;
using BaccaratPragmatic;

namespace BaccaratPragmatic
{
    public sealed class CwTotals
    {
        public long? B { get; set; }
        public long? P { get; set; }
        public long? T { get; set; }
        public double? A { get; set; }
        public string N { get; set; }
        public long? SD { get; set; }
        public long? TT { get; set; }
        public long? T3T { get; set; }
        public long? T3D { get; set; }
        public long? TD { get; set; }
        public string? TB { get; set; }
        public double? TA { get; set; }
        public string? rawTB { get; set; }
        public string? rawTA { get; set; }
        public string? Source { get; set; }
    }

    public sealed class CwSnapshot
    {
        public string abx { get; set; }
        public double? prog { get; set; }
        public string? progSource { get; set; }
        public string? progTail { get; set; }
        public CwTotals totals { get; set; }
        public string? tableName { get; set; }
        public long? tableId { get; set; }
        public string? tableSource { get; set; }
        public string? seqTableName { get; set; }
        public long? seqTableId { get; set; }
        public string? seqTableSource { get; set; }
        public string seq { get; set; }
        public string rawSeq { get; set; }
        public long? seqVersion { get; set; }
        public string seqEvent { get; set; }
        public string? seqSource { get; set; }
        public string? seqAppend { get; set; }
        public string? seqMode { get; set; }
        public string? seqWhich { get; set; }
        public string? niSeq { get; set; }
        public long ts { get; set; }
        public string side { get; set; }
        public long? amount { get; set; }
        public string error { get; set; }
        public string session { get; set; }
        public string username { get; set; }
        public string status { get; set; }
        public string? statusSource { get; set; }
        public string? statusTail { get; set; }
        public string? contextId { get; set; }
        public string? framePath { get; set; }
        public string? href { get; set; }
        public string? topHref { get; set; }
        public bool? isTop { get; set; }
        public string? authorityToken { get; set; }
        public int? contextScore { get; set; }
        public string? contextConfidence { get; set; }
        public string? signals { get; set; }
        public string? proxyChildFramePath { get; set; }
        public string? proxyChildHref { get; set; }
        public int? proxyChildScore { get; set; }
        public string? proxyChildSignals { get; set; }
        public string? dataMode { get; set; }
        public string? dataFramePath { get; set; }
        public string? dataHref { get; set; }
        public string? panelFramePath { get; set; }
        public string? panelHref { get; set; }
        public long? jsBuildMs { get; set; }
        public long? jsProgMs { get; set; }
        public long? jsTotalsMs { get; set; }
        public long? jsSeqMs { get; set; }
        public int? jsPerfMode { get; set; }
    }

    public sealed class FrameScoutSnapshot
    {
        public string abx { get; set; } = "";
        public string contextId { get; set; } = "";
        public string framePath { get; set; } = "";
        public string href { get; set; } = "";
        public string topHref { get; set; } = "";
        public bool isTop { get; set; }
        public string docKey { get; set; } = "";
        public int score { get; set; }
        public string confidence { get; set; } = "";
        public string signals { get; set; } = "";
        public bool hasThemeZone { get; set; }
        public bool hasProcessStatus { get; set; }
        public bool hasProcessBar { get; set; }
        public bool hasBeadRoad { get; set; }
        public bool hasBetBox { get; set; }
        public bool hasGameMain { get; set; }
        public bool hasZoneBet { get; set; }
        public bool hasCocos { get; set; }
        public int canvasCount { get; set; }
        public string visibleRect { get; set; } = "";
        public string proxyChildFramePath { get; set; } = "";
        public string proxyChildHref { get; set; } = "";
        public int proxyChildScore { get; set; }
        public string proxyChildSignals { get; set; } = "";
        public long ts { get; set; }
    }

    public sealed class DecisionState
    {
        public int Step = 0;              // index chuỗi tiền (0-based)
        public bool PreferLarger = true;  // true: chọn cửa tổng LỚN; false: tổng BÉ
        public bool LastWin = false;
        public string? PreviousBetSide = null; // "BANKER"|"PLAYER"
        public string? CurrentBetSide = null; // "BANKER"|"PLAYER"
        public string? CurrentOutcome = null; // "BANKER"|"PLAYER"
        public int MoneyChainIndex { get; set; }      // đang ở chuỗi thứ mấy (0-based)
        public int MoneyChainStep { get; set; }       // đang ở mức thứ mấy trong chuỗi đó (0-based)
        public long MoneyChainProfit { get; set; }    // tiền đã gom được ở chuỗi hiện tại

    }

}


