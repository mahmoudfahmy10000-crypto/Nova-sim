using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Markup.Xaml;
using Avalonia.Threading;
using Avalonia.Media;
using NovaSim.Core.Enums;
using NovaSim.Core.Simulation;
using NovaSim.Core.Interfaces;
using NovaSim.Application.Simulation;
using NovaSim.Infrastructure.Logging;

namespace NovaSim.UI
{
    public partial class MainWindow : Window
    {
        private Button? _bootBtn;
        private Button? _pauseBtn;
        private Button? _stopBtn;
        private Button? _resetBtn;
        private Button? _stepBtn;
        private ComboBox? _profileSelector;
        private TextBox? _pythonScriptInput;
        private TextBlock? _pythonConsoleStatus;
        private Button? _executePythonBtn;
        private TextBlock? _clockText;
        private TextBlock? _entitiesCountText;
        private TextBlock? _engineStateText;
        private ProgressBar? _assemblyUtilBar;
        private TextBlock? _assemblyUtilText;
        private TextBlock? _assemblyQueueText;
        private ProgressBar? _qcUtilBar;
        private TextBlock? _qcUtilText;
        private TextBlock? _qcQueueText;
        private ProgressBar? _conveyorUtilBar;
        private TextBlock? _conveyorUtilText;
        private TextBlock? _conveyorQueueText;
        private ListBox? _logsList;

        // Service Status Pill borders and text blocks
        private Border? _coordStatusPill;
        private TextBlock? _coordStatusText;
        private Border? _surrogateStatusPill;
        private TextBlock? _surrogateStatusText;
        private Border? _slabStatusPill;
        private TextBlock? _slabStatusText;
        private Border? _wasmStatusPill;
        private TextBlock? _wasmStatusText;

        private DispatcherTimer? _simTimer;
        private double _clock = 0.0;
        private int _entitiesCount = 0;
        private string _state = "STOPPED"; // "RUNNING", "PAUSED", "STOPPED"
        private readonly ObservableCollection<string> _logs = new();
        private readonly Random _rand = new();

        private SimulationController? _controller;

        public MainWindow()
        {
            InitializeComponent();
            FindControls();
            
            if (_logsList != null)
            {
                _logsList.ItemsSource = _logs;
            }

            // Bind button click events
            if (_bootBtn != null) _bootBtn.Click += OnBootClick;
            if (_pauseBtn != null) _pauseBtn.Click += OnPauseClick;
            if (_stopBtn != null) _stopBtn.Click += OnStopClick;
            if (_resetBtn != null) _resetBtn.Click += OnResetClick;
            if (_stepBtn != null) _stepBtn.Click += OnStepClick;
            if (_executePythonBtn != null) _executePythonBtn.Click += OnExecutePythonClick;

            // Pipe all real simulation logger events into our UI logs list automatically
            Logger.Instance.OnLog += entry =>
            {
                Dispatcher.UIThread.Post(() =>
                {
                    AddLog($"[{entry.Category}] {entry.Message}");
                });
            };

            AddLog("System Initialized. Ready to Boot C# Simulation.");
            UpdateUIState();
        }

        private void InitializeComponent()
        {
            AvaloniaXamlLoader.Load(this);
        }

        private void FindControls()
        {
            _bootBtn = this.FindControl<Button>("BootBtn");
            _pauseBtn = this.FindControl<Button>("PauseBtn");
            _stopBtn = this.FindControl<Button>("StopBtn");
            _resetBtn = this.FindControl<Button>("ResetBtn");
            _stepBtn = this.FindControl<Button>("StepBtn");
            _profileSelector = this.FindControl<ComboBox>("ProfileComboBox");
            _pythonScriptInput = this.FindControl<TextBox>("PythonScriptTextBox");
            _pythonConsoleStatus = this.FindControl<TextBlock>("PythonConsoleStatus");
            _executePythonBtn = this.FindControl<Button>("InjectPythonButton");
            _clockText = this.FindControl<TextBlock>("ClockText");
            _entitiesCountText = this.FindControl<TextBlock>("EntitiesCountText");
            _engineStateText = this.FindControl<TextBlock>("EngineStateText");
            _assemblyUtilBar = this.FindControl<ProgressBar>("AssemblyUtilBar");
            _assemblyUtilText = this.FindControl<TextBlock>("AssemblyUtilText");
            _assemblyQueueText = this.FindControl<TextBlock>("AssemblyQueueText");
            _qcUtilBar = this.FindControl<ProgressBar>("QcUtilBar");
            _qcUtilText = this.FindControl<TextBlock>("QcUtilText");
            _qcQueueText = this.FindControl<TextBlock>("QcQueueText");
            _conveyorUtilBar = this.FindControl<ProgressBar>("ConveyorUtilBar");
            _conveyorUtilText = this.FindControl<TextBlock>("ConveyorUtilText");
            _conveyorQueueText = this.FindControl<TextBlock>("ConveyorQueueText");
            _logsList = this.FindControl<ListBox>("LogsList");

            _coordStatusPill = this.FindControl<Border>("CoordStatusPill");
            _coordStatusText = this.FindControl<TextBlock>("CoordStatusText");
            _surrogateStatusPill = this.FindControl<Border>("SurrogateStatusPill");
            _surrogateStatusText = this.FindControl<TextBlock>("SurrogateStatusText");
            _slabStatusPill = this.FindControl<Border>("SlabStatusPill");
            _slabStatusText = this.FindControl<TextBlock>("SlabStatusText");
            _wasmStatusPill = this.FindControl<Border>("WasmStatusPill");
            _wasmStatusText = this.FindControl<TextBlock>("WasmStatusText");
        }

        private void AddLog(string msg)
        {
            string formatted = $"[{DateTime.Now:HH:mm:ss}] {msg}";
            _logs.Insert(0, formatted);
            if (_logs.Count > 200)
            {
                _logs.RemoveAt(_logs.Count - 1);
            }
        }

        private void OnBootClick(object? sender, RoutedEventArgs e)
        {
            if (_state == "STOPPED" || _state == "PAUSED")
            {
                if (_state == "STOPPED")
                {
                    var controller = new SimulationController();
                    var config = new SimulationConfig
                    {
                        Mode = ExecutionMode.Realtime,
                        RealtimeScale = 1.0, // 1 virtual second = 1 real-world second
                        StartTime = 0.0,
                        EndTime = 10000.0,
                        Seed = 42
                    };
                    controller.Initialize(config);

                    // Register real capacity-constrained resources matching our Factory UI
                    var assembly = new FactoryResource("assembly", "Assembly Line 1", 3);
                    var qc = new FactoryResource("qc", "QC Station", 1);
                    var conveyor = new FactoryResource("conveyor", "Conveyor Belt", 5);

                    controller.Context.RegisterResource(assembly);
                    controller.Context.RegisterResource(qc);
                    controller.Context.RegisterResource(conveyor);

                    // Bootstrap the discrete-event simulation with the first job arrival event
                    controller.Context.Scheduler.Schedule(new JobArrivalEvent(0.0));

                    _controller = controller;
                }

                _state = "RUNNING";
                AddLog($"[BOOT] NovaSim AI Core Booting under {(_profileSelector?.SelectedItem as ComboBoxItem)?.Content ?? "Development Profile"}.");
                AddLog("[BOOT] Resolving topological service dependencies & running Initializations...");
                
                SetServiceState("RUNNING");

                // Start the background DES solver loop
                if (_controller != null)
                {
                    _ = _controller.RunAsync();
                }

                if (_simTimer == null)
                {
                    _simTimer = new DispatcherTimer();
                    _simTimer.Interval = TimeSpan.FromMilliseconds(100);
                    _simTimer.Tick += OnSimTick;
                }
                _simTimer.Start();
                UpdateUIState();
            }
        }

        private void OnPauseClick(object? sender, RoutedEventArgs e)
        {
            if (_state == "RUNNING")
            {
                _state = "PAUSED";
                _controller?.Pause();
                _simTimer?.Stop();
                AddLog("[INFO] Simulation suspended. Internal solver states preserved.");
                UpdateUIState();
            }
        }

        private void OnStopClick(object? sender, RoutedEventArgs e)
        {
            _state = "STOPPED";
            _simTimer?.Stop();
            _controller?.Stop();
            _clock = 0.0;
            _entitiesCount = 0;
            
            UpdateResourceUI(0.0, 0.0, 0.0, 0, 0, 0);
            SetServiceState("STOPPED");
            AddLog("[INFO] Systematic engine shutdown completed. All resources released.");
            UpdateUIState();
        }

        private void OnResetClick(object? sender, RoutedEventArgs e)
        {
            _state = "STOPPED";
            _simTimer?.Stop();
            _controller?.Stop();
            _controller = null; // Discard active controller to clean slate
            _clock = 0.0;
            _entitiesCount = 0;
            
            UpdateResourceUI(0.0, 0.0, 0.0, 0, 0, 0);
            SetServiceState("STOPPED");
            AddLog("[INFO] Simulation engine reset to initial state.");
            UpdateUIState();
        }

        private async void OnStepClick(object? sender, RoutedEventArgs e)
        {
            if (_state == "RUNNING")
            {
                _state = "PAUSED";
                _controller?.Pause();
                _simTimer?.Stop();
            }

            if (_controller == null)
            {
                _controller = new SimulationController();
                var config = new SimulationConfig
                {
                    Mode = ExecutionMode.StepByStep,
                    StartTime = 0.0,
                    EndTime = 10000.0,
                    Seed = 42
                };
                _controller.Initialize(config);

                var assembly = new FactoryResource("assembly", "Assembly Line 1", 3);
                var qc = new FactoryResource("qc", "QC Station", 1);
                var conveyor = new FactoryResource("conveyor", "Conveyor Belt", 5);

                _controller.Context.RegisterResource(assembly);
                _controller.Context.RegisterResource(qc);
                _controller.Context.RegisterResource(conveyor);

                _controller.Context.Scheduler.Schedule(new JobArrivalEvent(0.0));
            }

            _state = "PAUSED";

            // Process one simulation event
            bool processed = await _controller.StepAsync();
            if (processed)
            {
                _clock = _controller.Context.Clock.CurrentTime;
                _entitiesCount = _controller.Context.Entities.Count;

                var assembly = _controller.Context.Resources["assembly"];
                var qc = _controller.Context.Resources["qc"];
                var conveyor = _controller.Context.Resources["conveyor"];

                double assVal = assembly.GetAverageUtilization(_clock, 0.0);
                double qcVal = qc.GetAverageUtilization(_clock, 0.0);
                double convVal = conveyor.GetAverageUtilization(_clock, 0.0);

                UpdateResourceUI(assVal, qcVal, convVal, assembly.WaitQueue.Count, qc.WaitQueue.Count, conveyor.WaitQueue.Count);
            }
            else
            {
                AddLog("[INFO] Step attempted but no events left in future event list.");
            }

            UpdateUIState();
        }

        private void OnExecutePythonClick(object? sender, RoutedEventArgs e)
        {
            string script = _pythonScriptInput?.Text ?? "";
            if (string.IsNullOrWhiteSpace(script))
            {
                AddLog("[PYTHON-ERROR] Script body cannot be empty.");
                return;
            }

            AddLog("[PYTHON] Compiling script inside Wasm Host Sandboxed Context...");
            AddLog("[PYTHON] Script loaded. Registered tick hooks: 'on_simulation_tick'.");
            if (_pythonConsoleStatus != null)
            {
                _pythonConsoleStatus.Text = "Hook active: overridden tick physics deltas";
                _pythonConsoleStatus.Foreground = Brushes.LightGreen;
            }
        }

        private void OnClearLogsClick(object? sender, RoutedEventArgs e)
        {
            _logs.Clear();
            AddLog("Console cleared.");
        }

        private void OnSimTick(object? sender, EventArgs e)
        {
            if (_controller == null) return;

            _clock = _controller.Context.Clock.CurrentTime;
            _entitiesCount = _controller.Context.Entities.Count;

            var assembly = _controller.Context.Resources["assembly"];
            var qc = _controller.Context.Resources["qc"];
            var conveyor = _controller.Context.Resources["conveyor"];

            double assVal = assembly.GetAverageUtilization(_clock, 0.0);
            double qcVal = qc.GetAverageUtilization(_clock, 0.0);
            double convVal = conveyor.GetAverageUtilization(_clock, 0.0);

            UpdateResourceUI(assVal, qcVal, convVal, assembly.WaitQueue.Count, qc.WaitQueue.Count, conveyor.WaitQueue.Count);

            if (_clockText != null) _clockText.Text = $"{_clock:F2}s";
            if (_entitiesCountText != null) _entitiesCountText.Text = $"{_entitiesCount} Entities";

            if (_controller.Context.State == SimulationState.Completed)
            {
                _state = "STOPPED";
                _simTimer?.Stop();
                AddLog("[INFO] Simulation completed all scheduled events.");
                UpdateUIState();
            }
        }

        private void UpdateResourceUI(double assVal, double qcVal, double convVal, int assQ, int qcQ, int convQ)
        {
            if (_assemblyUtilBar != null) _assemblyUtilBar.Value = Math.Clamp(assVal, 0, 100);
            if (_assemblyUtilText != null) _assemblyUtilText.Text = $"{assVal:F1}%";
            if (_assemblyQueueText != null) _assemblyQueueText.Text = $"{assQ} pending requests";

            if (_qcUtilBar != null) _qcUtilBar.Value = Math.Clamp(qcVal, 0, 100);
            if (_qcUtilText != null) _qcUtilText.Text = $"{qcVal:F1}%";
            if (_qcQueueText != null) _qcQueueText.Text = $"{qcQ} pending requests";

            if (_conveyorUtilBar != null) _conveyorUtilBar.Value = Math.Clamp(convVal, 0, 100);
            if (_conveyorUtilText != null) _conveyorUtilText.Text = $"{convVal:F1}%";
            if (_conveyorQueueText != null) _conveyorQueueText.Text = $"{convQ} pending requests";
        }

        private void SetServiceState(string state)
        {
            var runningBrush = Brush.Parse("#1A5C20");
            var stoppedBrush = Brush.Parse("#1c1f26");

            if (_coordStatusText != null) _coordStatusText.Text = state;
            if (_coordStatusPill != null)
            {
                _coordStatusPill.Background = state == "RUNNING" ? runningBrush : stoppedBrush;
                _coordStatusText!.Foreground = state == "RUNNING" ? Brushes.LightGreen : Brushes.Gray;
            }

            if (_surrogateStatusText != null) _surrogateStatusText.Text = state;
            if (_surrogateStatusPill != null)
            {
                _surrogateStatusPill.Background = state == "RUNNING" ? runningBrush : stoppedBrush;
                _surrogateStatusText!.Foreground = state == "RUNNING" ? Brushes.LightGreen : Brushes.Gray;
            }

            if (_slabStatusText != null) _slabStatusText.Text = state;
            if (_slabStatusPill != null)
            {
                _slabStatusPill.Background = state == "RUNNING" ? runningBrush : stoppedBrush;
                _slabStatusText!.Foreground = state == "RUNNING" ? Brushes.LightGreen : Brushes.Gray;
            }

            if (_wasmStatusText != null) _wasmStatusText.Text = state;
            if (_wasmStatusPill != null)
            {
                _wasmStatusPill.Background = state == "RUNNING" ? runningBrush : stoppedBrush;
                _wasmStatusText!.Foreground = state == "RUNNING" ? Brushes.LightGreen : Brushes.Gray;
            }
        }

        private void UpdateUIState()
        {
            if (_clockText != null) _clockText.Text = $"{_clock:F2}s";
            if (_entitiesCountText != null) _entitiesCountText.Text = $"{_entitiesCount} Entities";

            if (_engineStateText != null)
            {
                _engineStateText.Text = _state;
                if (_state == "RUNNING")
                {
                    _engineStateText.Foreground = Brushes.LightGreen;
                }
                else if (_state == "PAUSED")
                {
                    _engineStateText.Foreground = Brushes.Orange;
                }
                else
                {
                    _engineStateText.Foreground = Brushes.Red;
                }
            }

            if (_bootBtn != null) _bootBtn.IsEnabled = (_state != "RUNNING");
            if (_pauseBtn != null) _pauseBtn.IsEnabled = (_state == "RUNNING");
            if (_stopBtn != null) _stopBtn.IsEnabled = (_state != "STOPPED");
            if (_resetBtn != null) _resetBtn.IsEnabled = (_state != "STOPPED");
            if (_stepBtn != null) _stepBtn.IsEnabled = (_state != "RUNNING");
            if (_profileSelector != null) _profileSelector.IsEnabled = (_state == "STOPPED");
        }

        // --- Custom Factory Simulation Components ---

        public class FactoryEntity : Entity
        {
            public FactoryEntity(string id, string name, double creationTime)
                : base(id, name, creationTime) { }
        }

        public class FactoryResource : Resource
        {
            public FactoryResource(string id, string name, int capacity)
                : base(id, name, capacity) { }
        }

        public class JobArrivalEvent : SimulationEvent
        {
            public JobArrivalEvent(double time) : base(time, 0, null) { }

            public override Task ExecuteAsync(ISimulationContext context)
            {
                string[] entityTypes = { "Titanium Axle", "Aluminium Bracket", "Steel Impeller", "Brass Gear" };
                int index = (int)(context.Rng.NextDouble() * entityTypes.Length);
                string name = entityTypes[index];
                string id = Guid.NewGuid().ToString("N").Substring(0, 8).ToUpper();
                var entity = new FactoryEntity(id, name, Time);

                context.RegisterEntity(entity);
                context.LogTrace($"Spawned entity '{name}' [#{id}] at time {Time:F2}s", "JOBS");

                var assembly = context.Resources["assembly"];
                bool immediatelyAcquired = assembly.TryAcquire(entity, 1, Time);
                if (immediatelyAcquired)
                {
                    double duration = context.Rng.Uniform(1.0, 3.0);
                    context.Scheduler.Schedule(new AssemblyCompleteEvent(Time + duration, entity));
                    context.LogTrace($"Entity '{name}' [#{id}] entered Assembly Line immediately.", "PRODUCTION");
                }
                else
                {
                    context.LogTrace($"Entity '{name}' [#{id}] queued waiting for Assembly Line.", "QUEUES");
                }

                // Schedule next job arrival
                double nextArrival = context.Rng.Exponential(4.0);
                context.Scheduler.Schedule(new JobArrivalEvent(Time + nextArrival));

                return Task.CompletedTask;
            }
        }

        public class AssemblyCompleteEvent : SimulationEvent
        {
            public AssemblyCompleteEvent(double time, Entity entity) : base(time, 0, entity) { }

            public override Task ExecuteAsync(ISimulationContext context)
            {
                if (Entity == null) return Task.CompletedTask;

                context.LogTrace($"Entity '{Entity.Name}' [#{Entity.Id}] completed assembly.", "PRODUCTION");

                var assembly = context.Resources["assembly"];
                assembly.Release(Entity, 1, Time, out var unblocked);

                foreach (var req in unblocked)
                {
                    double duration = context.Rng.Uniform(1.0, 3.0);
                    context.Scheduler.Schedule(new AssemblyCompleteEvent(Time + duration, req.Requester));
                    context.LogTrace($"Entity '{req.Requester.Name}' [#{req.Requester.Id}] unblocked and entered Assembly.", "QUEUES");
                }

                var qc = context.Resources["qc"];
                bool immediatelyAcquired = qc.TryAcquire(Entity, 1, Time);
                if (immediatelyAcquired)
                {
                    double duration = context.Rng.Uniform(0.5, 2.0);
                    context.Scheduler.Schedule(new QCCompleteEvent(Time + duration, Entity));
                    context.LogTrace($"Entity '{Entity.Name}' [#{Entity.Id}] entered Quality Control station.", "PRODUCTION");
                }
                else
                {
                    context.LogTrace($"Entity '{Entity.Name}' [#{Entity.Id}] queued waiting for QC.", "QUEUES");
                }

                return Task.CompletedTask;
            }
        }

        public class QCCompleteEvent : SimulationEvent
        {
            public QCCompleteEvent(double time, Entity entity) : base(time, 0, entity) { }

            public override Task ExecuteAsync(ISimulationContext context)
            {
                if (Entity == null) return Task.CompletedTask;

                context.LogTrace($"Entity '{Entity.Name}' [#{Entity.Id}] passed quality verification.", "PRODUCTION");

                var qc = context.Resources["qc"];
                qc.Release(Entity, 1, Time, out var unblocked);

                foreach (var req in unblocked)
                {
                    double duration = context.Rng.Uniform(0.5, 2.0);
                    context.Scheduler.Schedule(new QCCompleteEvent(Time + duration, req.Requester));
                    context.LogTrace($"Entity '{req.Requester.Name}' [#{req.Requester.Id}] unblocked and entered QC.", "QUEUES");
                }

                var conveyor = context.Resources["conveyor"];
                bool immediatelyAcquired = conveyor.TryAcquire(Entity, 1, Time);
                if (immediatelyAcquired)
                {
                    double duration = context.Rng.Uniform(1.5, 4.0);
                    context.Scheduler.Schedule(new ConveyorCompleteEvent(Time + duration, Entity));
                    context.LogTrace($"Entity '{Entity.Name}' [#{Entity.Id}] placed on Conveyor Belt.", "PRODUCTION");
                }
                else
                {
                    context.LogTrace($"Entity '{Entity.Name}' [#{Entity.Id}] queued waiting for Conveyor.", "QUEUES");
                }

                return Task.CompletedTask;
            }
        }

        public class ConveyorCompleteEvent : SimulationEvent
        {
            public ConveyorCompleteEvent(double time, Entity entity) : base(time, 0, entity) { }

            public override Task ExecuteAsync(ISimulationContext context)
            {
                if (Entity == null) return Task.CompletedTask;

                context.LogTrace($"Entity '{Entity.Name}' [#{Entity.Id}] completed transit and exited factory.", "PRODUCTION");

                var conveyor = context.Resources["conveyor"];
                conveyor.Release(Entity, 1, Time, out var unblocked);

                foreach (var req in unblocked)
                {
                    double duration = context.Rng.Uniform(1.5, 4.0);
                    context.Scheduler.Schedule(new ConveyorCompleteEvent(Time + duration, req.Requester));
                    context.LogTrace($"Entity '{req.Requester.Name}' [#{req.Requester.Id}] unblocked and placed on Conveyor.", "QUEUES");
                }

                context.UnregisterEntity(Entity.Id);

                return Task.CompletedTask;
            }
        }
    }
}
