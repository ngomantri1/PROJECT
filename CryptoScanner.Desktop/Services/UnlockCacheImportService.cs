using System.Diagnostics;
using System.IO;
using CryptoScanner.Desktop.Models;

namespace CryptoScanner.Desktop.Services;

public sealed class UnlockCacheImportService
{
 readonly UnlockCacheInspector _inspector;

 public UnlockCacheImportService(int defaultMaxCacheAgeHours = 72)
 {
  _inspector = new UnlockCacheInspector(defaultMaxCacheAgeHours);
 }

 public async Task<UnlockImportResult> ImportAsync(string sourcePath, CancellationToken ct = default)
 {
  var sw = Stopwatch.StartNew();
  var targetPath = AppPaths.UnlockCachePath;
  var tempPath = Path.Combine(AppPaths.DataDirectory, "unlock-cache.importing.tmp");
  var backupPath = Path.Combine(AppPaths.DataDirectory, "unlock-cache.previous.json");

  try
  {
   var inspection = await _inspector.InspectFileAsync(sourcePath, strictImport: true, ct);
   if (!inspection.Success)
   {
    AppLogger.Warn($"UNLOCK_IMPORT_FAILED source_file={Path.GetFileName(sourcePath)} error_code={inspection.StatusCode} message={inspection.Message} target_preserved=true elapsed_ms={sw.ElapsedMilliseconds}");
    return FromInspection(false, inspection, targetPath, true);
   }

   Directory.CreateDirectory(AppPaths.DataDirectory);
   if (File.Exists(tempPath)) File.Delete(tempPath);

   var bytes = await File.ReadAllBytesAsync(sourcePath, ct);
   await File.WriteAllBytesAsync(tempPath, bytes, ct);

   var tempInspection = await _inspector.InspectFileAsync(tempPath, strictImport: true, ct);
   if (!tempInspection.Success)
   {
    DeleteTemp(tempPath);
    AppLogger.Warn($"UNLOCK_IMPORT_FAILED source_file={Path.GetFileName(sourcePath)} error_code={tempInspection.StatusCode} message={tempInspection.Message} target_preserved=true elapsed_ms={sw.ElapsedMilliseconds}");
    return FromInspection(false, tempInspection, targetPath, true);
   }

   var backupCreated = false;
   if (File.Exists(targetPath))
   {
    if (File.Exists(backupPath)) File.Delete(backupPath);
    File.Replace(tempPath, targetPath, backupPath, ignoreMetadataErrors: true);
    backupCreated = File.Exists(backupPath);
   }
   else
   {
    File.Move(tempPath, targetPath);
   }

   AppLogger.Info($"UNLOCK_IMPORT_SUCCESS source_file={Path.GetFileName(sourcePath)} target_path={targetPath} schema_version={inspection.Summary.SchemaVersion} items_total={inspection.Summary.ItemsTotal} items_valid={inspection.Summary.ItemsValid} items_invalid={inspection.Summary.ItemsInvalid} is_expired={inspection.Summary.IsExpired} backup_created={backupCreated} elapsed_ms={sw.ElapsedMilliseconds}");

   return FromInspection(true, inspection, targetPath, false);
  }
  catch (Exception ex) when (ex is not OperationCanceledException)
  {
   DeleteTemp(tempPath);
   AppLogger.Warn($"UNLOCK_IMPORT_FAILED source_file={Path.GetFileName(sourcePath)} error_code=WRITE_FAILED message={ex.Message} target_preserved=true elapsed_ms={sw.ElapsedMilliseconds}");
   return new UnlockImportResult
   {
    Success = false,
    StatusCode = "WRITE_FAILED",
    Message = ex.Message,
    ExistingCachePreserved = true,
    TargetPath = targetPath
   };
  }
 }

 static UnlockImportResult FromInspection(bool success, UnlockCacheInspectionResult inspection, string targetPath, bool existingCachePreserved)
 {
  return new UnlockImportResult
  {
   Success = success,
   StatusCode = success ? (inspection.Summary.IsExpired ? "IMPORT_SUCCESS_EXPIRED" : "IMPORT_SUCCESS") : inspection.StatusCode,
   Message = success
    ? (inspection.Summary.IsExpired ? "Imported cache is already expired. Run scanner again to apply it." : "Unlock cache imported successfully. Run scanner again to apply it.")
    : inspection.Message,
   SchemaVersion = inspection.Summary.SchemaVersion,
   UpdatedAt = inspection.Summary.UpdatedAt,
   ItemsTotal = inspection.Summary.ItemsTotal,
   ItemsValid = inspection.Summary.ItemsValid,
   ItemsInvalid = inspection.Summary.ItemsInvalid,
   IsExpired = inspection.Summary.IsExpired,
   ExistingCachePreserved = existingCachePreserved,
   TargetPath = targetPath
  };
 }

 static void DeleteTemp(string path)
 {
  try
  {
   if (File.Exists(path)) File.Delete(path);
  }
  catch
  {
   // Best effort cleanup only.
  }
 }
}
