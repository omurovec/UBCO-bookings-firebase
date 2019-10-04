import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

//Initialize firestore
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

//Add booking to firestore
export const addBooking = booking =>
	db
		.collection("users")
		.doc(booking.phone)
		.collection("bookings")
		.doc(booking.bookingID)
		.set({
			id: booking.bookingID,
			year: booking.year,
			month: booking.month,
			day: booking.day,
			startTime: booking.startTime,
			endTime: booking.endTime,
			area: booking.area,
			roomID: booking.roomID,
			title: booking.title,
			description: booking.description,
			roomName: booking.roomName,
			areaName: booking.areaName
		});

//Delete booking from firestore
export const delBooking = booking =>
	db
		.collection("users")
		.doc(booking.phone)
		.collection("bookings")
		.doc(booking.id)
		.delete();

export const createUser = user =>
	db
		.collection("users")
		.doc(user.phoneNumber)
		.set({ phone: user.phoneNumber });
