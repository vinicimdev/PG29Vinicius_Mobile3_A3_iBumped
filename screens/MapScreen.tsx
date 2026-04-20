import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import MapView, { Circle } from 'react-native-maps';
import { db } from '../firebaseConfig';

const COLORS = {
  good: '#2ecc71',
  rough: '#f39c12',
  bump: '#e74c3c',
};

interface BumpPoint {
  id: string;
  latitude: number;
  longitude: number;
  quality: 'good' | 'rough' | 'bump'; 
}

export default function MapScreen() {
  const [points, setPoints] = useState<BumpPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const fetchPoints = async () => {
      try {
        const snapshot = await db.collection('bumps').get();
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as BumpPoint[];
        setPoints(data);
        console.log('Points fetched:', data.length);
        console.log('First point:', data[0]);
      } catch (e) {
        throw new Error(`Failed to fetch points: ${e as Error}`);
      } finally {
        setLoading(false);
      }
    };

    fetchPoints();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const clearAllPoints = async () => {
    setClearing(true);
    try {
      const snapshot = await db.collection('bumps').get();
      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      setPoints([]);
      console.log('All points cleared');
    } catch (e) {
      throw new Error(`Failed to clear points: ${e as Error}`);
    } finally {
      setClearing(false);
    }
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        showsUserLocation={true}
        followsUserLocation={true}
        initialRegion={{
          latitude: points[0]?.latitude ?? 49.2401,
          longitude: points[0]?.longitude ?? -123.0687,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}>
        {points.map((point) => {
          return(
            <Circle
              key={point.id}
              center={{ latitude: point.latitude, longitude: point.longitude }}
              radius={5}
              fillColor={COLORS[point.quality]}
              strokeColor={COLORS[point.quality]}
              strokeWidth={2}
            />
          );
        })}
        </MapView>
        <TouchableOpacity style={styles.clearButton} onPress={clearAllPoints} disabled={clearing}>
          <Text style={styles.clearButtonText}> {clearing ? 'Clearing Points...' : 'Clear All Pointspron'} </Text>
        </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButton: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: '#e74c3c',
    paddingHorizontal: 24,
    paddingVertical: 24,
    borderRadius: 24,
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});