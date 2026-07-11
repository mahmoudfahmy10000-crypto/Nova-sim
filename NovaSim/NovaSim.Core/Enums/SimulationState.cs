namespace NovaSim.Core.Enums
{
    /// <summary>
    /// Represents the current operational state of the discrete-event simulation engine.
    /// </summary>
    public enum SimulationState
    {
        /// <summary>
        /// The simulation context has been created and configured but has not yet started execution.
        /// </summary>
        Created,

        /// <summary>
        /// The simulation engine is actively processing events from the Future Event List (FEL).
        /// </summary>
        Running,

        /// <summary>
        /// Execution has been temporarily suspended and can be resumed without losing history or clock state.
        /// </summary>
        Paused,

        /// <summary>
        /// The simulation was explicitly terminated by user intervention or control systems before completion.
        /// </summary>
        Stopped,

        /// <summary>
        /// The simulation reached its natural conclusion (no more scheduled events or maximum end-time boundary exceeded).
        /// </summary>
        Completed
    }
}
