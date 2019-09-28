import * as functions from "firebase-functions";
import { addBooking, delBooking } from "./firestore";
import {
	login,
	fetchAreas,
	fetchBookings,
	getBookingForm,
	postBooking,
	deleteBooking,
	getBookingID
} from "./sitemap";

export const testCredentials = functions.https.onRequest(
	(request, response) => {
		login(request.body)
			.then((res: { success: boolean }) => {
				response.status(200).send(res);
			})
			.catch(err => {
				response.status(400).send({ success: false });
			});
	}
);

export const fetchSchedule = functions.https.onRequest(
	async (request, response) => {
		try {
			//Fetch all the available rooms
			const rooms = await fetchAreas(request.body);
			//Fetch all the bookings in those rooms
			fetchBookings(rooms)
				.then(result => {
					response.status(200).send({
						success: true,
						data: result
					});
				})
				.catch(err => {
					response.status(400).send({
						success: false,
						data: "Error fetching bookings"
					});
				});
		} catch (err) {
			response
				.status(400)
				.send({
					success: false,
					data: "Error fetching areas"
				});
		}
	}
);

export const bookSlot = functions.https.onRequest(
	async (request, response) => {
		//Login to get session
		const session: any = await login(request.body);
		if (session.success) {
			try {
				//Fetch form
				const form = await getBookingForm(session.cookie);
				//Add request info to form and post to /studyrooms
				await postBooking(request.body, session, form);
				//Get the booking ID for future deletion
				const id = await getBookingID(request.body);
				//Add booking to firestore with booking ID
				await addBooking({ ...request, bookingID: id });
				response.status(200).send({ success: true });
			} catch (err) {
				response
					.status(400)
					.send({
						success: false,
						data: "Error booking slot"
					});
			}
		} else {
			response
				.status(400)
				.send({
					success: false,
					data: "Invalid login credentials"
				});
		}
	}
);

export const cancelSlot = functions.https.onRequest(
	async (request, response) => {
		//Login to get session
		const session: any = await login(request.body);
		if (session.success) {
			//Cancel booking on UBCO's site
			deleteBooking(session, request.body)
				.then(async () => {
					//Delete booking from firestore
					await delBooking(request.body.bookingID);
					response.status(200).send({
						success: true
					});
				})
				.catch(err => {
					response.status(400).send({
						success: false,
						data: "Error deleting booking"
					});
				});
		} else {
			response
				.status(400)
				.send({
					success: false,
					data: "Invalid login credentials"
				});
		}
	}
);
