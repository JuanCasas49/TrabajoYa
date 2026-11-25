import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { AppProvider, useApp } from './src/AppContext';
import { C, fam, setFontsOK } from './src/ui';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import JobsScreen from './src/screens/JobsScreen';
import CreateJobScreen from './src/screens/CreateJobScreen';
import MyJobsScreen from './src/screens/MyJobsScreen';
import JobDetailScreen from './src/screens/JobDetailScreen';
import ChatScreen from './src/screens/ChatScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: C.bg, card: C.bg, text: C.ink, primary: C.deep, border: C.line } };

const headerOptions = () => ({
  headerStyle: { backgroundColor: C.bg },
  headerShadowVisible: false,
  headerTintColor: C.ink,
  headerTitleStyle: { ...fam(700), fontSize: 17, color: C.ink },
  headerBackButtonDisplayMode: 'minimal',
});

const icon = (name) => ({ color, focused }) => <Ionicons name={focused ? name : `${name}-outline`} size={24} color={color} />;

function Tabs() {
  const { t } = useApp();
  return (
    <Tab.Navigator
      screenOptions={{
        ...headerOptions(),
        headerTitleAlign: 'left',
        headerTitleStyle: { ...fam(800), fontSize: 26, letterSpacing: -0.5, color: C.ink },
        tabBarActiveTintColor: C.deep,
        tabBarInactiveTintColor: '#8FA5B1',
        tabBarLabelStyle: { ...fam(600), fontSize: 12 },
        tabBarStyle: { height: 66, paddingTop: 6, paddingBottom: 8, backgroundColor: C.surface, borderTopWidth: 0, shadowColor: '#10293B', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
      }}>
      <Tab.Screen name="Jobs" component={JobsScreen} options={{ title: t('jobs'), tabBarIcon: icon('search') }} />
      <Tab.Screen name="Create" component={CreateJobScreen} options={{ title: t('publish'), tabBarIcon: icon('add-circle') }} />
      <Tab.Screen name="Mine" component={MyJobsScreen} options={{ title: t('mine'), tabBarIcon: icon('person-circle') }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, ready, t } = useApp();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator color={C.deep} /></View>;
  return (
    <Stack.Navigator screenOptions={headerOptions()}>
      {user ? (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: t('detail') }} />
          <Stack.Screen name="Chat" component={ChatScreen} options={({ route }) => ({ title: route.params.title })} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: t('register') }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [loaded, error] = useFonts({ PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold });
  setFontsOK(Boolean(loaded) && !error);
  if (!loaded && !error) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator color={C.deep} /></View>;
  return (
    <SafeAreaProvider>
      <AppProvider>
        <NavigationContainer theme={theme}>
          <Root />
        </NavigationContainer>
      </AppProvider>
    </SafeAreaProvider>
  );
}
