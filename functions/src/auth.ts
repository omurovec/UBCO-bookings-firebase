import * as functions from "firebase-functions";
import { createUser } from "./firestore";

export const newUser = functions.auth
	.user()
	.onCreate(user => createUser(user));
