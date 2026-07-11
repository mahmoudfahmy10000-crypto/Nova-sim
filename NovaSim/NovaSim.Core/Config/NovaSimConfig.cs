using NovaSim.Core.Enums;

namespace NovaSim.Core.Config
{
    public class LoggingConfig
    {
        public LogLevel MinLevel { get; set; } = LogLevel.DEBUG;
        public bool EnableConsole { get; set; } = true;
        public bool EnableRingBuffer { get; set; } = true;
        public int RingBufferCapacity { get; set; } = 250;
    }

    public class LimitsConfig
    {
        public int MaxWorkerThreads { get; set; } = 4;
        public long MemorySlabSizeBytes { get; set; } = 64 * 1024 * 1024; // 64MB
        public int MaxActiveEntities { get; set; } = 10000;
        public int PhysicsTickRateHz { get; set; } = 60;
    }

    public class DatabaseConfig
    {
        public string ConnectionString { get; set; } = "Data Source=novasim.db";
        public bool UseInMemory { get; set; } = false;
    }

    public class ScriptingConfig
    {
        public bool EnablePythonScripting { get; set; } = true;
        public string PythonScriptsDirectory { get; set; } = "./scripts";
    }

    public class NovaSimConfig
    {
        public string Profile { get; set; } = "development";
        public int Port { get; set; } = 3000;
        public string ApiVersion { get; set; } = "v1.0.0";
        public LoggingConfig Logging { get; set; } = new();
        public LimitsConfig Limits { get; set; } = new();
        public DatabaseConfig Database { get; set; } = new();
        public ScriptingConfig Scripting { get; set; } = new();
    }
}
