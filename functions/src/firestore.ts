import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

//Initialize firestore
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

//Add booking to firestore
export const addBooking = booking => db.collection("bookings").add(booking);

//Delete booking from firestore
export const delBooking = id =>
    db
        .collection("booking")
        .doc(id)
        .delete();
