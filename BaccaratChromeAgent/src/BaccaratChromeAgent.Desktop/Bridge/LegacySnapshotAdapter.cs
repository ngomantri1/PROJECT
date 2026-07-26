using System.Text.Json;
using BaccaratChromeAgent.Protocol;

namespace BaccaratSexyCasino2;

/// <summary>Maps the Chrome extension contract to the unchanged legacy JS tick contract.</summary>
internal static class LegacySnapshotAdapter
{
    private sealed record SequenceState(string Sequence, long Version);

    // The legacy WPF logic deliberately accepts a changed road only when the
    // producer gives it an explicit append contract.  Chrome's protocol sends
    // an authoritative full snapshot, so retain the last snapshot here solely
    // to translate it to that already-existing legacy contract.
    private static readonly object SequenceGate = new();
    private static readonly Dictionary<string, SequenceState> LastSequenceByTable = new(StringComparer.Ordinal);

    internal static string ToLegacyTick(GameSnapshot snapshot, DisplayState display)
    {
        var sequence = FilterSequence(snapshot.Sequence);
        var tableKey = string.IsNullOrWhiteSpace(snapshot.TableId)
            ? (display.TableId ?? "unknown")
            : snapshot.TableId;

        string sequenceMode;
        string sequenceEvent;
        string sequenceAppend;
        long sequenceVersion;

        lock (SequenceGate)
        {
            LastSequenceByTable.TryGetValue(tableKey, out var previous);
            sequenceAppend = TryGetAppend(previous?.Sequence, sequence);

            if (previous is null)
            {
                sequenceMode = "full-rebase";
                sequenceEvent = "hydrate-init";
                sequenceVersion = Math.Max(snapshot.Round ?? 0, sequence.Length);
            }
            else if (!string.IsNullOrEmpty(sequenceAppend))
            {
                sequenceMode = "append";
                sequenceEvent = "append-chrome-extension";
                sequenceVersion = Math.Max(snapshot.Round ?? 0, previous.Version + sequenceAppend.Length);
            }
            else if (string.Equals(previous.Sequence, sequence, StringComparison.Ordinal))
            {
                sequenceMode = "hold";
                sequenceEvent = "no-change";
                sequenceVersion = Math.Max(snapshot.Round ?? 0, previous.Version);
            }
            else
            {
                // A non-overlapping sequence is only valid when a new shoe/table
                // has genuinely been selected. Keep the old app's conservative
                // rebase handling instead of inventing a result delta.
                sequenceMode = "full-rebase";
                sequenceEvent = "hydrate-init";
                sequenceVersion = Math.Max(snapshot.Round ?? 0, Math.Max(previous.Version + 1, sequence.Length));
            }

            LastSequenceByTable[tableKey] = new SequenceState(sequence, sequenceVersion);
        }

        return JsonSerializer.Serialize(new
        {
            abx = "tick",
            prog = snapshot.Progress,
            progSource = "chrome-extension",
            progTail = "native-host",
            seq = sequence,
            rawSeq = sequence,
            seqVersion = sequenceVersion,
            seqEvent = sequenceEvent,
            seqSource = "chrome-extension",
            seqMode = sequenceMode,
            seqAppend = sequenceAppend,
            tableId = snapshot.TableId ?? display.TableId ?? string.Empty,
            tableName = snapshot.TableName ?? display.TableName ?? string.Empty,
            tableSource = "chrome-extension",
            seqTableId = snapshot.TableId ?? display.TableId ?? string.Empty,
            seqTableName = snapshot.TableName ?? display.TableName ?? string.Empty,
            seqTableSource = "chrome-extension",
            status = snapshot.Phase ?? display.Status ?? string.Empty,
            statusSource = "chrome-extension",
            statusTail = "native-host",
            contextId = "chrome-extension:" + (snapshot.TableId ?? display.TableId ?? "unknown"),
            contextScore = 1000,
            contextConfidence = "extension-game-frame",
            signals = "native-host,chrome-extension",
            dataMode = "chrome-extension",
            ts = snapshot.ObservedAtUtc.ToUnixTimeMilliseconds(),
            totals = new
            {
                B = snapshot.BankerPool,
                P = snapshot.PlayerPool,
                T = snapshot.TiePool,
                TB = snapshot.TableName ?? display.TableName ?? string.Empty,
                Source = "chrome-extension"
            }
        });
    }

    private static string FilterSequence(string? value) =>
        new string((value ?? string.Empty).Where(c => c is 'B' or 'P' or 'T').ToArray());

    private static string TryGetAppend(string? previous, string current)
    {
        if (string.IsNullOrEmpty(previous) || string.IsNullOrEmpty(current))
            return string.Empty;

        if (current.StartsWith(previous, StringComparison.Ordinal))
            return current[previous.Length..];

        // The source keeps a bounded road. Preserve the exact legacy append
        // meaning when its left side has rolled out of the visible window.
        var maximumOverlap = Math.Min(previous.Length, current.Length);
        for (var overlap = maximumOverlap; overlap > 0; overlap--)
        {
            if (previous.EndsWith(current[..overlap], StringComparison.Ordinal))
                return current[overlap..];
        }

        return string.Empty;
    }
}
