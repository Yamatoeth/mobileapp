import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Ionicons } from '@expo/vector-icons'
import { ChatScreen } from '../screens/ChatScreen'
import { LogScreen } from '../screens/LogScreen'
// Progress screen removed in pivot
import { ProfileScreen } from '../screens/ProfileScreen'
import { useTheme } from '../hooks/useTheme'

const Tab = createBottomTabNavigator()

export function TabNavigator() {
  const { isDark } = useTheme()
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#111827' : '#fff',
          borderTopWidth: 1,
          borderTopColor: isDark ? '#374151' : '#eee',
          paddingTop: 8,
          height: 85,
        },
        tabBarActiveTintColor: '#0066ff',
        tabBarInactiveTintColor: isDark ? '#6b7280' : '#999',
      }}
    >
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Log"
        component={LogScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="clipboard-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Progress tab removed in pivot */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  )
}
