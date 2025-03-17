package pkg

import (
	"github.com/Et43/BARK/constant"
	"github.com/Et43/BARK/database/dto"
)

func Null() interface{} {
	return nil
}

func BuildResponse[T any](responseStatus constant.ResponseStatus, data T) dto.ApiResponse[T] {
	return BuildResponse_(responseStatus.GetResponseStatus(), responseStatus.GetResponseMessage(), data)
}

func BuildResponse_[T any](responseKey string, responseMessage string, data T) dto.ApiResponse[T] {
	return dto.ApiResponse[T]{ResponseKey: responseKey, ResponseMessage: responseMessage, Data: data}
}
