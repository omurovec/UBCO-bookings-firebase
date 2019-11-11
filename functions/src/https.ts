import * as functions from "firebase-functions";
import {
	login,
	fetchAreas,
	fetchBookings,
	getBookingForm,
	postBooking,
	deleteBooking,
	fetchBooked
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
			response.status(400).send({
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
				const form: any = await getBookingForm(
					session.cookie
				);
				//Add request info to form and post to /studyrooms
				const result = await postBooking(
					request.body,
					session,
					form.formData
				);
				response.status(200).send(result);
			} catch (err) {
				response.status(400).send({
					success: false,
					data: "Error booking slot"
				});
			}
		} else {
			response.status(400).send({
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
					response.status(200).send({
						success: true
					});
				})
				.catch(err => {
					console.log(err);
					response.status(400).send({
						success: false,
						data: "Error deleting booking"
					});
				});
		} else {
			response.status(400).send({
				success: false,
				data: "Invalid login credentials"
			});
		}
	}
);

export const getBooked = functions.https.onRequest(
	async (request, response) => {
		const session: any = await login(request.body);
		if (session.success) {
			fetchBooked({ ...session, ...request.body })
				.then(res => {
					response.status(200).send(res);
				})
				.catch(err => {
					console.log(err);
					response.status(400).send({ success: false });
				});
		} else {
			response.status(400).send({ success: false });
		}
	}
);
