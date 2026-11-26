import { registerGlobals } from '@livekit/react-native';
import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import App from './App';
import { widgetTaskHandler } from './src/widget';

// WebRTC for room calls (LiveKit) needs its globals before anything else uses them.
registerGlobals();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
// Android home-screen widget: runs in the background when a widget needs drawing.
registerWidgetTaskHandler(widgetTaskHandler);
