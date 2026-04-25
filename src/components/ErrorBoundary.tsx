import React, { Component, PropsWithChildren } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  PropsWithChildren<{ fallback?: React.ReactNode }>,
  ErrorBoundaryState
> {
  constructor(props: PropsWithChildren<{ fallback?: React.ReactNode }>) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <View className="flex-1 items-center justify-center bg-black p-5">
          <Text className="text-red-500 text-base mb-4" accessibilityRole="header">
            Something went wrong
          </Text>
          <Text className="text-white text-center mb-5">
            {this.state.error?.message || 'An unexpected error occurred'}
          </Text>
          <TouchableOpacity
            onPress={this.resetError.bind(this)}
            className="bg-blue-600 px-5 py-2 rounded-lg"
            accessibilityRole="button"
            accessibilityLabel="Try again"
            accessibilityHint="Resets this screen after the error"
          >
            <Text className="text-white font-semibold">Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }

  private resetError() {
    this.setState({ hasError: false, error: null });
  }
}
