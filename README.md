# iBumped

iBumped is a mobile app for cyclists to check and register the quality of the roads and bike lanes along the streets.
Using the phone's Accelerometer and GPS hardwares, the app detects bumps and plots them on the map (circles with color-coded indicators), showing where the cyclist had the 'bumpiest' areas.

## Features

- Real time accelerometer monitoring the road quality
- GPS tracking
- Data persistance with AsyncStorage (local storage) and Firestore (cloud storage)
- Firebase authentication (with email and password)
- Map displays the circles with colors indicating the quality of the road
- Integration with Google Roads API for snapping the location of the bumps to the roads

## Stack

- Made using React Native + Expo and TypeScript
- Accelerometer and GPS (expo-location)
- React native maps
- Firebase (Authentication + Firestore)
- Google Roads API

## Screens

For now the app features 3 screens:
- Login -> User authentication (login/register)
- Debug -> Sensor values, road quality check, start/stop ride
- Map -> Bump points visualization with colorized circles

## How to use the App

The user registers and logs in with email and password using Firebase Auth and goes to the Debug Screen.
On the Debug Screen, the user clicks on Start Ride.
Every 3 seconds the app checks the accelerometer and classifies it as Good, Rough or Bump.
When the user ends the ride, the bumps are first stored all locally, then the points are synced and sent to Firestore in a single batch, to avoid overloading the communication with the database.
The map screen then fetches all points from Firestore and renders the bumps as the colorful circles pinned to the position where the bump happened.

## Setup

This project was built on Expo Snack, so to run it you have to open the Snack URL on your Android device via Expo Go (mobile app).

## Author

Made by PG29 Vinicius, @VFS 2025-2026 All rights reserved.