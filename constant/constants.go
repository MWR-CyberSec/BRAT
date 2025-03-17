package constant

type ResponseStatus int
type Headers int
type General int

const (
	Success ResponseStatus = iota + 1
	DataNotFound
	UnkownError
	InvalidRequest
	Unauthorised
)

func (r ResponseStatus) GetResponseStatus() string {
	return [...]string{"", "SUCCESS", "DATA_NOT_FOUND", "UNKOWN_ERROR", "INVALID_REQUEST", "UNAUTHORISED"}[r]
}

func (r ResponseStatus) GetResponseMessage() string {
	return [...]string{"", "Success", "Data not found", "Unkown error", "Invalid request", "Unauthorised"}[r]
}
