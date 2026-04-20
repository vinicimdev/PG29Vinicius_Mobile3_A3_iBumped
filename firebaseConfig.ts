import * as firebase from 'firebase';
import 'firebase/auth';
import 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBw6EY1c8HwEuavQlAZ8ZzRppySKskVR3Q",
  authDomain: "pg29viniciusmob3ibumped.firebaseapp.com",
  projectId: "pg29viniciusmob3ibumped",
  storageBucket: "pg29viniciusmob3ibumped.firebasestorage.app",
  messagingSenderId: "1064940747314",
  appId: "1:1064940747314:web:9ac8ebf31f34e434c61a2b",
  measurementId: "G-WYHFJHFEWP"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

export { auth, db, firebase };