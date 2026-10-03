// Thrown by the client (and the mocks) for non-2xx responses.
// `message` is the backend's `detail` string when there is one.
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
