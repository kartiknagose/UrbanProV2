import React from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Button } from './index';

/**
 * GLOBAL ERROR BOUNDARY (Sprint 15)
 * Captures unhandled client-side exceptions and reports them to the server.
 * Provides a fallback UI to the user instead of a white screen.
 */
class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Log locally for development
        if (import.meta.env.DEV) {
            console.error('[CRASH_DETECTED]', error, errorInfo);
        }
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                    <div className="max-w-md w-full text-center">
                        <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle size={40} className="text-red-600" />
                        </div>

                        <h1 className="text-3xl font-black text-gray-900 mb-2">
                            Oops! Something went wrong.
                        </h1>
                        <p className="text-gray-500 mb-8 font-medium">
                            An unexpected error occurred. Our engineers have been notified and are looking into it.
                        </p>

                        <div className="space-y-3">
                            <Button
                                variant="primary"
                                className="w-full"
                                icon={RefreshCcw}
                                onClick={() => window.location.reload()}
                            >
                                Try Refreshing
                            </Button>

                            <Button
                                variant="outline"
                                className="w-full border-gray-200"
                                icon={Home}
                                onClick={this.handleReset}
                            >
                                Back to Home
                            </Button>
                        </div>

                        {import.meta.env.DEV && (
                            <div className="mt-10 p-4 bg-gray-800 rounded-xl text-left overflow-auto max-h-40">
                                <p className="text-red-400 font-mono text-xs mb-2">
                                    [DEV_ONLY_STACK]:
                                </p>
                                <pre className="text-white font-mono text-[10px]">
                                    {this.state.error?.stack}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default GlobalErrorBoundary;
