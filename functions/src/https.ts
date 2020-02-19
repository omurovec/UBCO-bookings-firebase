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
      console.log("Beginning testCedentials with:");
      console.table(request.body);
		login(request.body)
			.then((res: { success: boolean }) => {
          if(res.success){
              console.log("Finished testCredentials successfully");
              response.status(200).send(res);
          }else {
              console.warn("Invalid login credentials")
              response.status(400).send({
				          success: false,
				          data: "Invalid login credentials"
			        });
          }
			})
			.catch(err => {
				console.warn(err);
				response.status(400).send({ success: false, data: err })
			});
	}
);

export const fetchSchedule = functions.https.onRequest(
	async (request, response) => {
			//Fetch all the available areas
			fetchAreas(request.body)
          .then(areas => {
            //Fetch all the bookings in those areas
			      fetchBookings(areas)
				        .then(result => {
					          response.status(200).send({
						            success: true,
						            data: result
					          });
				        })
				        .catch(err => {
					          console.warn(err);
					          response.status(400).send({
						            success: false,
						            data: err
					          });
				        });
        })
        .catch(err => {
              console.warn(err);
              response.status(400).send({success: false, data: err})
        })
	}
);

export const bookSlot = functions.https.onRequest(
	async (request, response) => {
      console.log("Beginning bookSlot with:");
      console.table(request.body);
		//Login to get session
		  login(request.body)
          .then(( session: {success: boolean, cookie: string} ) => {
              if(session.success){
                      //Fetch form
                  getBookingForm(session.cookie)
                      .then(( form: {formData: { csrf_token: string, editType: string, repID: string, returl: string, type: string}} ) => {
                        //Add request info to form and post to /studyrooms
                        postBooking(request.body,
                                    session,
                                    form.formData
                                    )
                            .then(result => {
                                    console.log("Finished bookSlot successfully")
                                    response.status(200).send(result);
                            })
                            .catch(err => {
                                    console.warn(err);
                                    response.status(400).send({
                                        success: false,
                                        data: err
                                    })
                            })
                    }).catch(err => {
                        console.warn(err);
                        response.status(400).send({
                            success: false,
                            data: err
                        })
                    })
              }else {
                  console.warn("Invalid login credentials")
                  response.status(400).send({
				              success: false,
				              data: "Invalid login credentials"
			            });
              }
          })
          .catch(err => {
              console.warn(err);
			        response.status(400).send({
				          success: false,
				          data: err
			        });
          });

	}
);

export const cancelSlot = functions.https.onRequest(
	async (request, response) => {
		//Login to get session
		  console.log("Beginning cancelSlot with:");
      console.table(request.body);
      login(request.body)
          .then((session: {success: boolean}) => {
              if(session.success) {
                  //Cancel booking on UBCO's site
			            deleteBooking(session, request.body)
				              .then(async () => {
					                response.status(200).send({
						                  success: true
					                });
				              })
				              .catch(err => {
					                console.warn(err);
					                response.status(400).send({
						                  success: false,
						                  data: err
					                });
				              });
              }else {
                  console.warn("Invalid login credentials")
                  response.status(400).send({
				              success: false,
				              data: "Invalid login credentials"
			            });
              }
            })
          .catch(err => {
              console.warn(err)
              response.status(400).send({
				          success: false,
				          data: err
			        });
          })
	}
);

export const getBooked = functions.https.onRequest(
	async (request, response) => {
      console.log("Beginning getBooked with:");
      console.table(request.body);
	    login(request.body)
          .then(( session: {success: boolean} ) => {
                if (session.success) {
                    fetchBooked({ ...session, ...request.body })
                        .then(res => {
                            console.log("Finished getBooked with: ");
                            console.table(res);
                            response.status(200).send(res);
                        })
                        .catch(err => {
                            console.warn(err);
                            response.status(400).send({ success: false });
                        });
                } else {
                    console.warn("Invalid login credentials");
                    response.status(400).send({
                        success: false,
                        data: "Invalid login credentials"
                    });
                }
          })
          .catch(err => {
          console.warn(err);
          response.status(400).send({
				      success: false,
				      data: "Invalid login credentials"
			    });
      })
  }
);
