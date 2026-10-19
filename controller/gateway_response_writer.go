package controller

import (
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
)

type gatewayResponseWriter struct {
	gin.ResponseWriter
	firstByte *atomic.Bool
	timer     *time.Timer
}

func (w *gatewayResponseWriter) started() {
	w.firstByte.Store(true)
	w.timer.Stop()
}

func (w *gatewayResponseWriter) Write(p []byte) (int, error) {
	w.started()
	return w.ResponseWriter.Write(p)
}

func (w *gatewayResponseWriter) WriteString(s string) (int, error) {
	w.started()
	return w.ResponseWriter.WriteString(s)
}

func (w *gatewayResponseWriter) WriteHeaderNow() {
	w.started()
	w.ResponseWriter.WriteHeaderNow()
}

func (w *gatewayResponseWriter) Flush() {
	w.started()
	w.ResponseWriter.Flush()
}
