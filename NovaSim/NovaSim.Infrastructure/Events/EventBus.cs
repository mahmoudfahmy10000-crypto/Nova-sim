using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using NovaSim.Core.Interfaces;

namespace NovaSim.Infrastructure.Events
{
    public class EventBus : IEventBus
    {
        private static readonly Lazy<EventBus> _instance = new(() => new EventBus());
        private readonly ConcurrentDictionary<string, List<(Action<EventPayload> callback, string id)>> _listeners = new();
        private readonly List<(Action<string, EventPayload> callback, string id)> _wildcardListeners = new();
        private readonly object _lock = new();

        private EventBus() { }

        public static EventBus Instance => _instance.Value;

        public Action Subscribe(string @event, Action<EventPayload> callback)
        {
            var id = Guid.NewGuid().ToString("N");
            lock (_lock)
            {
                var list = _listeners.GetOrAdd(@event, _ => new List<(Action<EventPayload>, string)>());
                list.Add((callback, id));
            }

            return () =>
            {
                lock (_lock)
                {
                    if (_listeners.TryGetValue(@event, out var list))
                    {
                        list.RemoveAll(item => item.id == id);
                    }
                }
            };
        }

        public Action SubscribeAll(Action<string, EventPayload> callback)
        {
            var id = Guid.NewGuid().ToString("N");
            lock (_lock)
            {
                _wildcardListeners.Add((callback, id));
            }

            return () =>
            {
                lock (_lock)
                {
                    _wildcardListeners.RemoveAll(item => item.id == id);
                }
            };
        }

        public void Publish(string @event, string sender, object? data = null)
        {
            var payload = new EventPayload(DateTime.UtcNow, sender, data);

            // Fetch exact matches
            List<(Action<EventPayload> callback, string id)>? exact = null;
            lock (_lock)
            {
                if (_listeners.TryGetValue(@event, out var list))
                {
                    exact = new List<(Action<EventPayload> callback, string id)>(list);
                }
            }

            if (exact != null)
            {
                foreach (var (callback, _) in exact)
                {
                    try
                    {
                        callback(payload);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[EventBus] Error in exact event handler for '{@event}': {ex.Message}");
                    }
                }
            }

            // Fetch wildcards
            List<(Action<string, EventPayload> callback, string id)> wildcards;
            lock (_lock)
            {
                wildcards = new List<(Action<string, EventPayload> callback, string id)>(_wildcardListeners);
            }

            foreach (var (callback, _) in wildcards)
            {
                try
                {
                    callback(@event, payload);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[EventBus] Error in wildcard event handler for '{@event}': {ex.Message}");
                }
            }
        }

        public void ClearAllListeners()
        {
            lock (_lock)
            {
                _listeners.Clear();
                _wildcardListeners.Clear();
            }
        }
    }
}
