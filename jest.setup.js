// Jest setup for React Native testing
// Polyfill browser streaming globals that some Expo packages expect
if (typeof global.TextDecoderStream === 'undefined') {
	global.TextDecoderStream = function () {}
}
if (typeof global.TextDecoder === 'undefined') {
	global.TextDecoder = function () { this.decode = () => '' }
}
if (typeof global.TextEncoder === 'undefined') {
	global.TextEncoder = function () { this.encode = () => new Uint8Array() }
}
// Define __DEV__ used by react-native
if (typeof global.__DEV__ === 'undefined') {
	global.__DEV__ = true
}
try {
	require('@testing-library/jest-native/extend-expect')
} catch (e) {
	// ignore if not installed
}

// Silence native warnings (guarded)
try {
	jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper')
} catch (e) {
	// ignore if module path differs in this RN version
}
