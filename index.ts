import { registerRootComponent } from 'expo';

// Ensure Skia safe wrappers run before any other module may import Skia.
// This prevents native factory calls (e.g. Picture.MakePicture) from receiving
// `null`/non-ArrayBuffer arguments during early initialization.
import './src/utils/skiaSafe'

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
