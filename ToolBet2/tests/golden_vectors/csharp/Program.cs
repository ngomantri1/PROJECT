using System.Reflection;
using System.Text.Json;
using BaccaratSexyCasino2.Tasks;

record VectorCase(string id, string manager_id, long[] stakes, long[][]? stake_chains, string[][] rounds);
record VectorFile(int version, List<VectorCase> cases);

static class Program
{
    static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true, WriteIndented = true };

    static bool? Win(string side, string result) => result == "T" ? null : side == result;
    static double Pnl(string side, long stake, bool? win) => win switch
    {
        null => 0,
        false => -stake,
        _ when side == "B" => Math.Round(stake * .95, 0, MidpointRounding.AwayFromZero),
        _ => stake,
    };
    static int Field(MoneyManager manager, string name) => (int)typeof(MoneyManager)
        .GetField(name, BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(manager)!;

    static List<object> RunStandard(VectorCase vector)
    {
        var manager = new MoneyManager(vector.stakes, vector.manager_id);
        var rows = new List<object>(); double sessionPnl = 0;
        for (var index = 0; index < vector.rounds.Length; index++)
        {
            var side = vector.rounds[index][0]; var result = vector.rounds[index][1];
            var stake = manager.GetStakeForThisBet(); var win = Win(side, result); var pnl = Pnl(side, stake, win);
            sessionPnl += pnl; manager.OnRoundResult(win);
            rows.Add(new { round = index + 1, side, result, stake, pnl, session_pnl = sessionPnl,
                level_index = Field(manager, "_i"), chain_index = 0, next_stake = manager.GetStakeForThisBet() });
        }
        return rows;
    }

    static List<object> RunMultiChain(VectorCase vector)
    {
        var chains = vector.stake_chains!; var totals = chains.Select(chain => chain.Sum()).ToArray();
        var rows = new List<object>(); var chainIndex = 0; var levelIndex = 0; var chainProfit = 0.0; var sessionPnl = 0.0;
        for (var index = 0; index < vector.rounds.Length; index++)
        {
            var side = vector.rounds[index][0]; var result = vector.rounds[index][1];
            var stake = MoneyHelper.CalcAmountMultiChain(chains, chainIndex, levelIndex); var win = Win(side, result); var pnl = Pnl(side, stake, win);
            sessionPnl += pnl;
            MoneyHelper.UpdateAfterRoundMultiChain(chains, totals, ref chainIndex, ref levelIndex, ref chainProfit, win, pnl);
            rows.Add(new { round = index + 1, side, result, stake, pnl, session_pnl = sessionPnl,
                level_index = levelIndex, chain_index = chainIndex, next_stake = MoneyHelper.CalcAmountMultiChain(chains, chainIndex, levelIndex) });
        }
        return rows;
    }

    static int Main(string[] args)
    {
        if (args.Length != 1) { Console.Error.WriteLine("Usage: GoldenVectors <cases.json>"); return 2; }
        var vectors = JsonSerializer.Deserialize<VectorFile>(File.ReadAllText(args[0]), Json)!;
        var result = vectors.cases.ToDictionary(vector => vector.id, vector =>
            vector.manager_id == "MultiChain" ? RunMultiChain(vector) : RunStandard(vector));
        Console.WriteLine(JsonSerializer.Serialize(result, Json));
        return 0;
    }
}
