using System;
using NovaSim.Core.Config;
using NovaSim.Core.Enums;
using NovaSim.Core.Interfaces;

namespace NovaSim.Infrastructure.Config
{
    public class ConfigManager : IConfigManager
    {
        private static readonly Lazy<ConfigManager> _instance = new(() => new ConfigManager());
        private NovaSimConfig _config = new();
        private readonly object _lock = new();

        private ConfigManager()
        {
            LoadProfile("development");
        }

        public static ConfigManager Instance => _instance.Value;

        public NovaSimConfig GetConfig()
        {
            lock (_lock)
            {
                // Shallow clone for basic thread safety or return direct reference
                return _config;
            }
        }

        public void LoadProfile(string profile)
        {
            lock (_lock)
            {
                var newConfig = new NovaSimConfig { Profile = profile };
                
                if (profile.ToLower() == "testing")
                {
                    newConfig.Port = 8080;
                    newConfig.Logging.MinLevel = LogLevel.INFO;
                    newConfig.Limits.MaxWorkerThreads = 2;
                    newConfig.Limits.MemorySlabSizeBytes = 16 * 1024 * 1024; // 16MB
                    newConfig.Limits.MaxActiveEntities = 1000;
                    newConfig.Limits.PhysicsTickRateHz = 30;
                    newConfig.Database.ConnectionString = "Data Source=:memory:";
                    newConfig.Database.UseInMemory = true;
                }
                else if (profile.ToLower() == "production")
                {
                    newConfig.Port = 3000;
                    newConfig.Logging.MinLevel = LogLevel.WARN;
                    newConfig.Limits.MaxWorkerThreads = 8;
                    newConfig.Limits.MemorySlabSizeBytes = 256 * 1024 * 1024; // 256MB
                    newConfig.Limits.MaxActiveEntities = 100000;
                    newConfig.Limits.PhysicsTickRateHz = 120;
                    newConfig.Database.ConnectionString = "Data Source=novasim_prod.db";
                    newConfig.Database.UseInMemory = false;
                }
                else // Development
                {
                    newConfig.Port = 3000;
                    newConfig.Logging.MinLevel = LogLevel.TRACE;
                    newConfig.Limits.MaxWorkerThreads = 4;
                    newConfig.Limits.MemorySlabSizeBytes = 64 * 1024 * 1024; // 64MB
                    newConfig.Limits.MaxActiveEntities = 10000;
                    newConfig.Limits.PhysicsTickRateHz = 60;
                    newConfig.Database.ConnectionString = "Data Source=novasim_dev.db";
                    newConfig.Database.UseInMemory = false;
                }

                _config = newConfig;
            }
        }

        public void UpdateConfig(NovaSimConfig newConfig)
        {
            lock (_lock)
            {
                // Core validation logic
                if (newConfig.Port <= 0 || newConfig.Port > 65535)
                {
                    throw new ArgumentException("Invalid port configuration bounds. Must be between 1 and 65535.");
                }

                if (newConfig.Limits.MaxWorkerThreads <= 0 || newConfig.Limits.MaxWorkerThreads > 128)
                {
                    throw new ArgumentException("Invalid maxWorkerThreads configuration bounds. Must be between 1 and 128.");
                }

                _config = newConfig;
            }
        }
    }
}

