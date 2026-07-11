using System;
using System.Collections.Generic;
using NovaSim.Core.Enums;
using NovaSim.Core.Interfaces;

namespace NovaSim.Infrastructure.Logging
{
    public class LogEntry : ILogEntry
    {
        public string Id { get; } = Guid.NewGuid().ToString("N");
        public DateTime Timestamp { get; } = DateTime.UtcNow;
        public LogLevel Level { get; set; }
        public string Category { get; set; } = "GENERAL";
        public string Message { get; set; } = string.Empty;
        public Exception? Exception { get; set; }
    }

    public class Logger : ILogger
    {
        private static readonly Lazy<Logger> _instance = new(() => new Logger());
        private readonly List<LogEntry> _ringBuffer = new();
        private readonly object _lock = new();

        private LogLevel _minLevel = LogLevel.DEBUG;
        private bool _enableConsole = true;
        private bool _enableRingBuffer = true;
        private int _ringBufferCapacity = 250;

        private Logger() { }

        public static Logger Instance => _instance.Value;

        public event Action<ILogEntry>? OnLog;

        public void Configure(LogLevel minLevel, bool enableConsole, bool enableRingBuffer, int ringBufferCapacity)
        {
            lock (_lock)
            {
                _minLevel = minLevel;
                _enableConsole = enableConsole;
                _enableRingBuffer = enableRingBuffer;
                _ringBufferCapacity = ringBufferCapacity;
            }
        }

        private void WriteLog(LogLevel level, string message, string category, Exception? exception = null)
        {
            if (level < _minLevel) return;

            var entry = new LogEntry
            {
                Level = level,
                Message = message,
                Category = category,
                Exception = exception
            };

            if (_enableConsole)
            {
                var color = Console.ForegroundColor;
                switch (level)
                {
                    case LogLevel.TRACE: Console.ForegroundColor = ConsoleColor.DarkGray; break;
                    case LogLevel.DEBUG: Console.ForegroundColor = ConsoleColor.Cyan; break;
                    case LogLevel.INFO: Console.ForegroundColor = ConsoleColor.Green; break;
                    case LogLevel.WARN: Console.ForegroundColor = ConsoleColor.Yellow; break;
                    case LogLevel.ERROR: Console.ForegroundColor = ConsoleColor.Red; break;
                    case LogLevel.FATAL: Console.ForegroundColor = ConsoleColor.Magenta; break;
                }
                Console.WriteLine($"[{entry.Timestamp:HH:mm:ss}] [{level}] [{category}] {message}");
                if (exception != null)
                {
                    Console.WriteLine(exception.ToString());
                }
                Console.ForegroundColor = color;
            }

            if (_enableRingBuffer)
            {
                lock (_lock)
                {
                    _ringBuffer.Add(entry);
                    while (_ringBuffer.Count > _ringBufferCapacity)
                    {
                        _ringBuffer.RemoveAt(0);
                    }
                }
            }

            try
            {
                OnLog?.Invoke(entry);
            }
            catch
            {
                // Isolate callback failures
            }
        }

        public void Trace(string message, string category = "GENERAL") => WriteLog(LogLevel.TRACE, message, category);
        public void Debug(string message, string category = "GENERAL") => WriteLog(LogLevel.DEBUG, message, category);
        public void Info(string message, string category = "GENERAL") => WriteLog(LogLevel.INFO, message, category);
        public void Warn(string message, string category = "GENERAL") => WriteLog(LogLevel.WARN, message, category);
        public void Error(string message, Exception? exception = null, string category = "GENERAL") => WriteLog(LogLevel.ERROR, message, category, exception);
        public void Fatal(string message, Exception? exception = null, string category = "GENERAL") => WriteLog(LogLevel.FATAL, message, category, exception);

        public IReadOnlyList<ILogEntry> GetRingBuffer()
        {
            lock (_lock)
            {
                return _ringBuffer.ToArray();
            }
        }

        public void ClearRingBuffer()
        {
            lock (_lock)
            {
                _ringBuffer.Clear();
            }
        }
    }
}
