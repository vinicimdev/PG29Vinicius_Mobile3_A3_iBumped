import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  Accelerometer
} from 'expo-sensors';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth } from '../firebaseConfig';

type XYZ = { x: number; y: number; z: number};

interface LocationData {
  lat: number;
  lon: number;
  accuracy: number | null;
}

interface SnappedLocationData {
  latitude: number;
  longitude: number;
  placeId: string;
}

function SensorRow({title, data, unit="", color}: {title: string; data: XYZ; unit?: string; color: string}) {
  return (
    <View>
      <Text style={styles.sectionTitle}> {title} </Text>
      <View style={styles.pillRow}> {
        (['x', 'y', 'z'] as const).map((k) => (
          <View>
            <Text style={styles.pillKey}>{k.toUpperCase()}</Text>
            <Text style={styles.pillVal}>{data[k].toFixed(2)}{unit}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

type BumpQuality = 'good' | 'rough' | 'bump';

function classifyBump(accel: XYZ): BumpQuality {
  const magnitude = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
  // Remove gravity
  const delta = Math.abs(magnitude - 1);

  if (delta > 0.8) return 'bump';
  if (delta > 0.3) return 'rough';
  return 'good';
}

export default function DebugScreen({ navigation }: any) {
  const [accel, setAccel] = useState<XYZ>({x:0,y:0,z:0});
  const [active, setActive] = useState(true);
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snappedLocation, setSnappedLocation] = useState<SnappedLocationData | null>(null);
  const [currentQuality, setCurrentQuality] = useState<BumpQuality>('good');
  const [isRiding, setIsRiding] = useState(false);
  const [pointsCollected, setPointsCollected] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const getLocation = async () => {
    setLoading(true);
    setError(null);

    const { status } = await Location.requestForegroundPermissionsAsync();
    
    const snapToRoads = async (lat: number, lon: number) => {
    const API_KEY = 'AIzaSyAJsRiE3IAwAcYJk-770WizgKlmOZD7B5o';
    const url = `https://roads.googleapis.com/v1/snapToRoads?path=${lat},${lon}&key=${API_KEY}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch failed, status: ${response.status}`);
      
      const data = await response.json();
      console.log(data);

      const snapped = data.snappedPoints[0].location;
      setSnappedLocation({
        latitude: snapped.latitude,
        longitude: snapped.longitude,
        placeId: data.snappedPoints[0].placeId,
      });

    } catch (err) {
      throw new Error(`Failed fetching Roads API: ${err}`);
    }
  }

    if (status !== "granted") {
      setError("Location permission denied. Please allow it in the Settings.");
      setLoading(false);
      return;
    }

    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      const loc = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
      setLocation(loc);
      await snapToRoads(loc.lat, loc.lon);

      const [geocoded] = await Location.reverseGeocodeAsync({
        latitude: loc.lat,
        longitude: loc.lon,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isRiding) return;

    const interval = setInterval(async () => {
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        });

        await saveBumpPoint({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          quality: currentQuality,
          timestamp: Date.now(),
        });

        setPointsCollected((prev) => prev + 1);
      } catch (e) {
        throw new Error(`Error during ride point collection: ${e as Error}`);
      }
    }, 3000); // collects points every 3 seconds

    return () => clearInterval(interval);
  }, [isRiding, currentQuality]);

  useEffect(() => {
    if (!active) return;

    Accelerometer.setUpdateInterval(100);

    const sA = Accelerometer.addListener((data) => {
      setAccel(data);
      setCurrentQuality(classifyBump(data));
    });

    return () => {sA.remove();}
  }, [active]);

  const syncToFirestore = async () => {
    setSyncing(true);
    try {
      const existingData = await AsyncStorage.getItem('bumpPoints');
      if (!existingData) {
        console.log('No bump points to sync');
        return;
      }

      const points = JSON.parse(existingData);
      const userId = auth.currentUser?.uid;

      // Creates a document for each point in the 'bumps' collection
      const batch = db.batch();
      points.forEach((point: any) => {
        const ref = db.collection('bumps').doc();
        batch.set(ref, {
          ...point,
          userId,
          syncedAt: Date.now(),
        });
      });

      await batch.commit();
      console.log(`Synced ${points.length} points to Firestore`);
      await AsyncStorage.removeItem('bumpPoints');
    } catch (e) {
      throw new Error(`Failed to sync: ${e as Error}`);
    } finally {
      setSyncing(false);
    }
  }

  const saveBumpPoint = async(point: {
    latitude: number;
    longitude: number;
    quality: BumpQuality;
    timestamp: number;
  }) => {
    try {
      const existingData = await AsyncStorage.getItem('bumpPoints');
      const points = existingData ? JSON.parse(existingData) : [];
      points.push(point);
      await AsyncStorage.setItem('bumpPoints', JSON.stringify(points));
      
      console.log('Point saved, total points: ', points.length);
    } catch (e) {
      throw new Error(`Failed to save point: ${e as Error}`);
    }
  }

  const toggleRide = async () => {
    if (!isRiding) {
      // Sync with Firestore when stopping the ride
      await syncToFirestore();
    } else {
      // Resets the bump points counter when starting a new ride
      setPointsCollected(0);
    }
    setIsRiding(!isRiding);
  }

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (e: any) {
      throw new Error(`Failed to logout: ${e}`);
    }
  }

  return (
  <View style={styles.container}>
    <Text style={styles.appTitle}>iBumped</Text>

    <View style={styles.card}>
      <SensorRow title="Accelerometer" unit="(m/s^2)" data={accel} color="#4A90D9"/>
    </View>

    <View style={styles.card}>
      <Text style={styles.sectionTitle}> Road Quality </Text>
      <Text style={styles.infoText}> Current: {currentQuality.toUpperCase()} </Text>
    </View>

    <TouchableOpacity style={styles.button} onPress={toggleRide}>
      <Text style={styles.buttonText}>
        {isRiding ? "Stop ride" : "Start ride"}
      </Text>
    </TouchableOpacity>

    {syncing && (
      <View style={styles.card}>
        <Text style={styles.infoText}> Syncing points to cloud... </Text>
      </View>
    )}
    
    {isRiding && (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}> Ride Active </Text>
        <Text style={styles.infoText}> Bump Points Collected: {pointsCollected} </Text>
        <Text style={styles.infoText}> Current Quality: {currentQuality.toUpperCase()} </Text>
      </View>
    )}

    {error && <Text style={styles.errorText}>{error}</Text>}

    <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("Map")}>
      <Text style={styles.buttonText}> Check Map </Text>
    </TouchableOpacity>

    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
      <Text style={styles.buttonText}> Logout :( </Text>
    </TouchableOpacity>

  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
    gap: 16,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#222",
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#888",
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    gap: 8,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    gap: 2,
  },
  pillKey: {
    fontSize: 11,
    fontWeight: "700",
    color: '#888',
  },
  pillVal: {
    fontSize: 14,
    fontWeight: "600",
    color: '#222',
  },
  button: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#555',
  },
  errorText: {
    fontSize: 13,
    color: '#e74c3c',
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
})